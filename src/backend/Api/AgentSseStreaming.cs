using System.Text.Json;
using Microsoft.AspNetCore.Http;
using CaldovaSuper.Agents;

namespace CaldovaSuper.App.Api;

/// <summary>
/// Server-Sent Events helper used by every agent "Try It Out" /process endpoint
/// to stream the live Foundry agent response to the browser.
///
/// Each /process endpoint accepts a streaming request when the client sends
/// <c>Accept: text/event-stream</c>. The handler builds the prompt and the
/// final-envelope projection and delegates to <see cref="StreamAsync"/>, which
/// emits one <c>delta</c> event per text token plus a single terminal
/// <c>done</c> event carrying the same JSON envelope the non-streaming JSON
/// path returns. An <c>error</c> event is sent if the live agent throws.
///
/// When Foundry is not configured we still respond with SSE so the browser
/// keeps a uniform code path: zero deltas, then a <c>done</c> event with the
/// deterministic-fallback envelope so the page still flows end-to-end.
/// </summary>
internal static class AgentSseStreaming
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    /// <summary>
    /// Returns true when the request explicitly asks for an SSE stream via the
    /// HTTP <c>Accept</c> header. We deliberately require an exact match for
    /// <c>text/event-stream</c> so existing JSON callers keep working unchanged.
    /// </summary>
    public static bool WantsEventStream(HttpContext httpContext)
    {
        foreach (var value in httpContext.Request.Headers.Accept)
        {
            if (string.IsNullOrEmpty(value)) continue;
            if (value.Contains("text/event-stream", StringComparison.OrdinalIgnoreCase))
                return true;
        }
        return false;
    }

    /// <summary>
    /// Stream the agent's reply over SSE, then emit a final <c>done</c> event
    /// carrying <paramref name="buildEnvelope"/>'s projection of the agent
    /// trace into the page-specific envelope shape (fields, NIGO checklist,
    /// eligibility checklist, payment calculation, transfer plan, etc).
    ///
    /// Pass <paramref name="agent"/> as <c>null</c> to send only the
    /// deterministic-fallback envelope (zero deltas, single <c>done</c> event).
    /// This keeps the SSE branch usable when Foundry is not configured.
    /// </summary>
    public static async Task StreamAsync(
        HttpContext httpContext,
        CaldovaAgent? agent,
        string prompt,
        Func<AgentTraceResult?, string?, object> buildEnvelope,
        ILogger logger,
        string agentLabel)
    {
        var response = httpContext.Response;
        response.StatusCode = StatusCodes.Status200OK;
        response.Headers.ContentType = "text/event-stream";
        response.Headers.CacheControl = "no-cache";
        response.Headers["X-Accel-Buffering"] = "no";

        var ct = httpContext.RequestAborted;

        AgentTraceResult? trace = null;
        string? agentError = null;

        if (agent is not null)
        {
            try
            {
                (trace, agentError) = await ConsumeAsync(
                    response, () => agent.RunStreamingTraceAsync(prompt, ct), logger,
                    $"{agentLabel} streaming invocation failed; falling back to deterministic demo data", ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                // Client disconnected; nothing more to do.
                return;
            }
        }

        var envelope = buildEnvelope(trace, agentError);
        await WriteEventAsync(response, "done", envelope, ct);
    }

    /// <summary>
    /// Same as <see cref="StreamAsync"/> but resumes a previous Foundry agent
    /// conversation by chaining off <paramref name="previousResponseId"/> via
    /// <see cref="CaldovaSuper.Agents.BaseAgent.ChatStreamingTraceAsync"/>. Used by
    /// the "Chat with the agent" follow-up panels on each agent page.
    /// </summary>
    public static async Task StreamChatAsync(
        HttpContext httpContext,
        CaldovaAgent? agent,
        string previousResponseId,
        string message,
        Func<AgentTraceResult?, string?, object> buildEnvelope,
        ILogger logger,
        string agentLabel)
    {
        var response = httpContext.Response;
        response.StatusCode = StatusCodes.Status200OK;
        response.Headers.ContentType = "text/event-stream";
        response.Headers.CacheControl = "no-cache";
        response.Headers["X-Accel-Buffering"] = "no";

        var ct = httpContext.RequestAborted;

        AgentTraceResult? trace = null;
        string? agentError = null;

        if (agent is not null)
        {
            try
            {
                (trace, agentError) = await ConsumeAsync(
                    response, () => agent.ChatStreamingTraceAsync(previousResponseId, message, ct), logger,
                    $"{agentLabel} chat streaming invocation failed", ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                return;
            }
        }

        var envelope = buildEnvelope(trace, agentError);
        await WriteEventAsync(response, "done", envelope, ct);
    }

    private const int MaxRateLimitAttempts = 5;

    /// <summary>
    /// Forwards the agent's streamed text as <c>delta</c> events. A rate-limited
    /// response is retried after a short back-off, but only while nothing has
    /// been sent yet, so the browser never sees duplicated text. Any other
    /// failure becomes an <c>error</c> event plus the returned error message.
    /// </summary>
    private static async Task<(AgentTraceResult? Trace, string? Error)> ConsumeAsync(
        HttpResponse response,
        Func<IAsyncEnumerable<AgentStreamingEvent>> start,
        ILogger logger,
        string failureLog,
        CancellationToken ct)
    {
        for (var attempt = 1; ; attempt++)
        {
            var sentText = false;
            try
            {
                AgentTraceResult? trace = null;
                await foreach (var ev in start())
                {
                    switch (ev)
                    {
                        case AgentStreamingDelta delta:
                            if (!string.IsNullOrEmpty(delta.Text))
                            {
                                sentText = true;
                                await WriteEventAsync(response, "delta", new { text = delta.Text }, ct);
                            }
                            break;
                        case AgentStreamingCompleted completed:
                            trace = completed.Trace;
                            break;
                    }
                }
                return (trace, null);
            }
            catch (AgentResponseFailedException ex) when (ex.IsRateLimit && !ex.ToolsMayHaveRun && !sentText && attempt < MaxRateLimitAttempts)
            {
                logger.LogWarning("Agent response was rate limited; retrying (attempt {Attempt} of {Max}). Provider said: {ProviderMessage}",
                    attempt + 1, MaxRateLimitAttempts, ex.ProviderMessage);
                await Task.Delay(TimeSpan.FromSeconds(5 * attempt) + TimeSpan.FromMilliseconds(Random.Shared.Next(0, 2000)), ct);
            }
            catch (Exception ex) when (!(ex is OperationCanceledException && ct.IsCancellationRequested))
            {
                logger.LogWarning(ex, "{FailureLog}. Provider said: {ProviderMessage}", failureLog, (ex as AgentResponseFailedException)?.ProviderMessage);
                await WriteEventAsync(response, "error", new { message = ex.Message }, ct);
                return (null, ex.Message);
            }
        }
    }

    private static async Task WriteEventAsync(HttpResponse response, string eventName, object payload, CancellationToken ct)
    {
        if (ct.IsCancellationRequested) return;
        var json = JsonSerializer.Serialize(payload, JsonOptions);
        // SSE frames: each "data:" line is a single text line. Embedded newlines
        // would break the frame, so split the JSON across continuation lines.
        var safeJson = json.Replace("\r", string.Empty);
        var lines = safeJson.Split('\n');

        var sb = new System.Text.StringBuilder(safeJson.Length + 32);
        sb.Append("event: ").Append(eventName).Append('\n');
        foreach (var line in lines)
            sb.Append("data: ").Append(line).Append('\n');
        sb.Append('\n');

        await response.WriteAsync(sb.ToString(), ct);
        await response.Body.FlushAsync(ct);
    }
}
