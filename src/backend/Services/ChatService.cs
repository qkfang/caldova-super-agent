using System.Text;
using System.Text.Json;

namespace CaldovaSuper.App.Services;

/// <summary>
/// Talks to the configured Foundry "member assistant" agent. If no agent
/// endpoint is configured, returns a friendly demo response so the chatbots in the
/// UI still work end-to-end.
/// Ported from forex-trading-agent/src/research-analytics/Services/ChatService.cs.
/// </summary>
public class ChatService
{
    private readonly HttpClient _http;
    private readonly string? _agentEndpoint;
    private readonly ILogger<ChatService> _logger;
    private static readonly JsonSerializerOptions _jsonOptions = new() { PropertyNameCaseInsensitive = true };

    public ChatService(HttpClient http, IConfiguration config, ILogger<ChatService> logger)
    {
        _http = http;
        _agentEndpoint = config["FoundryAgent:EndpointUrl"]?.TrimEnd('/');
        _logger = logger;
    }

    public Task<string> SendMessageAsync(string userMessage, List<ChatTurn>? history = null) =>
        SendMessageWithOptionsAsync(userMessage, 0.7, history);

    public async Task<string> SendMessageWithOptionsAsync(string userMessage, double temperature, List<ChatTurn>? history = null)
    {
        if (string.IsNullOrWhiteSpace(_agentEndpoint))
        {
            return BuildDemoReply(userMessage);
        }

        var payload = new { message = userMessage, temperature };
        var json = JsonSerializer.Serialize(payload);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        _logger.LogInformation("Chat request: {Content}", json);

        try
        {
            var response = await _http.PostAsync($"{_agentEndpoint}/insight", content);
            response.EnsureSuccessStatusCode();
            var body = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<AgentInsightResponse>(body, _jsonOptions);
            return result?.Response ?? "No response from agent.";
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to get response from Foundry agent");
            return "Sorry, the Caldova member assistant is currently unavailable. Please try again later.";
        }
    }

    /// <summary>
    /// Demo response used when no Foundry agent endpoint is configured. Keeps the
    /// chatbot UX functional during local development and demos.
    /// </summary>
    private static string BuildDemoReply(string userMessage)
    {
        var trimmed = (userMessage ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            return "Please enter a question about your account, a request in progress, or how super rules work.";
        }

        return
            "Thanks for your message — this is the Caldova Wealth member assistant (offline mode).\n\n" +
            $"You asked: \"{trimmed}\"\n\n" +
            "In production, Caldova's specialised operations agents (Onboarding, Benefits & Eligibility, " +
            "Investment Solutions, Financial Crime, Transfers & Rollovers, Payments, Client Communications, " +
            "Team Leader) would coordinate to answer this — general information only, never personal " +
            "financial advice. Configure the FoundryAgent:EndpointUrl setting to connect this chatbot to a " +
            "live agent.";
    }
}

public class ChatTurn
{
    public string Role { get; set; } = "";
    public string Content { get; set; } = "";
}

public class AgentInsightResponse
{
    public string? Response { get; set; }
}
