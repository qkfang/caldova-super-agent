using PdfSharp.Fonts;

namespace CaldovaSuper.App.Services;

/// <summary>
/// PDFsharp 6.x ships no cross-platform font resolver. On native Linux
/// (Azure App Service Linux, Docker, CI runners) any call into MigraDoc
/// rendering otherwise throws
/// <c>"The font 'Courier New' cannot be resolved …"</c>.
///
/// This resolver scans the common Linux font directories for TTF/OTF
/// files at startup, then aliases the Windows family names we use in the
/// generated PDF (Arial / Courier New / Times New Roman) to whatever
/// libre font is actually installed (DejaVu, Liberation, FreeFont, etc.).
/// If nothing matches, the first font discovered is used as a fallback so
/// rendering still succeeds.
/// </summary>
internal sealed class LinuxFontResolver : IFontResolver
{
    private readonly Dictionary<string, byte[]> _faceData =
        new(StringComparer.OrdinalIgnoreCase);

    // Lower-cased requested family (+ "|bold" / "|italic" / "|bolditalic")
    // -> face key in _faceData.
    private readonly Dictionary<string, string> _familyMap =
        new(StringComparer.OrdinalIgnoreCase);

    private readonly string? _fallbackFaceKey;

    public LinuxFontResolver()
    {
        var searchDirs = new[]
        {
            "/usr/share/fonts",
            "/usr/local/share/fonts",
            "/usr/share/X11/fonts",
            "/opt/fonts",
            Path.Combine(Environment.GetEnvironmentVariable("HOME") ?? "/root", ".fonts"),
        };

        foreach (var dir in searchDirs)
        {
            if (string.IsNullOrEmpty(dir) || !Directory.Exists(dir)) continue;
            try
            {
                foreach (var file in Directory.EnumerateFiles(dir, "*.ttf", SearchOption.AllDirectories))
                    Register(file);
                foreach (var file in Directory.EnumerateFiles(dir, "*.otf", SearchOption.AllDirectories))
                    Register(file);
            }
            catch
            {
                // Ignore unreadable directories.
            }
        }

        // Map common Windows family names to whatever libre equivalents are present.
        AliasFamily("Arial",
            ("DejaVuSans", "DejaVuSans-Bold", "DejaVuSans-Oblique", "DejaVuSans-BoldOblique"),
            ("LiberationSans-Regular", "LiberationSans-Bold", "LiberationSans-Italic", "LiberationSans-BoldItalic"),
            ("FreeSans", "FreeSansBold", "FreeSansOblique", "FreeSansBoldOblique"));

        AliasFamily("Helvetica",
            ("DejaVuSans", "DejaVuSans-Bold", "DejaVuSans-Oblique", "DejaVuSans-BoldOblique"),
            ("LiberationSans-Regular", "LiberationSans-Bold", "LiberationSans-Italic", "LiberationSans-BoldItalic"));

        AliasFamily("Courier New",
            ("DejaVuSansMono", "DejaVuSansMono-Bold", "DejaVuSansMono-Oblique", "DejaVuSansMono-BoldOblique"),
            ("LiberationMono-Regular", "LiberationMono-Bold", "LiberationMono-Italic", "LiberationMono-BoldItalic"),
            ("FreeMono", "FreeMonoBold", "FreeMonoOblique", "FreeMonoBoldOblique"));

        AliasFamily("Courier",
            ("DejaVuSansMono", "DejaVuSansMono-Bold", "DejaVuSansMono-Oblique", "DejaVuSansMono-BoldOblique"),
            ("LiberationMono-Regular", "LiberationMono-Bold", "LiberationMono-Italic", "LiberationMono-BoldItalic"));

        AliasFamily("Times New Roman",
            ("DejaVuSerif", "DejaVuSerif-Bold", "DejaVuSerif-Italic", "DejaVuSerif-BoldItalic"),
            ("LiberationSerif-Regular", "LiberationSerif-Bold", "LiberationSerif-Italic", "LiberationSerif-BoldItalic"),
            ("FreeSerif", "FreeSerifBold", "FreeSerifItalic", "FreeSerifBoldItalic"));

        AliasFamily("Times",
            ("DejaVuSerif", "DejaVuSerif-Bold", "DejaVuSerif-Italic", "DejaVuSerif-BoldItalic"),
            ("LiberationSerif-Regular", "LiberationSerif-Bold", "LiberationSerif-Italic", "LiberationSerif-BoldItalic"));

        _fallbackFaceKey = _faceData.Keys.FirstOrDefault();
    }

    private void Register(string path)
    {
        try
        {
            var key = Path.GetFileNameWithoutExtension(path);
            if (string.IsNullOrEmpty(key) || _faceData.ContainsKey(key)) return;
            _faceData[key] = File.ReadAllBytes(path);
            _familyMap.TryAdd(key, key);
        }
        catch
        {
            // Ignore unreadable font files.
        }
    }

    /// <summary>
    /// Map a requested Windows family to the first set of regular/bold/italic/
    /// bold-italic face names that all exist in <see cref="_faceData"/>.
    /// </summary>
    private void AliasFamily(string requested,
        params (string Regular, string Bold, string Italic, string BoldItalic)[] candidates)
    {
        foreach (var c in candidates)
        {
            if (_faceData.ContainsKey(c.Regular))
            {
                _familyMap[requested] = c.Regular;
                if (_faceData.ContainsKey(c.Bold))
                    _familyMap[requested + "|bold"] = c.Bold;
                if (_faceData.ContainsKey(c.Italic))
                    _familyMap[requested + "|italic"] = c.Italic;
                if (_faceData.ContainsKey(c.BoldItalic))
                    _familyMap[requested + "|bolditalic"] = c.BoldItalic;
                return;
            }
        }
    }

    public FontResolverInfo? ResolveTypeface(string familyName, bool isBold, bool isItalic)
    {
        var style = (isBold, isItalic) switch
        {
            (true, true) => "|bolditalic",
            (true, false) => "|bold",
            (false, true) => "|italic",
            _ => string.Empty,
        };

        if (!string.IsNullOrEmpty(style)
            && _familyMap.TryGetValue(familyName + style, out var styled))
        {
            return new FontResolverInfo(styled);
        }

        if (_familyMap.TryGetValue(familyName, out var regular))
        {
            return new FontResolverInfo(regular);
        }

        // Last-ditch: exact match against installed face filename.
        if (_faceData.ContainsKey(familyName))
        {
            return new FontResolverInfo(familyName);
        }

        if (_fallbackFaceKey is not null)
        {
            return new FontResolverInfo(_fallbackFaceKey);
        }

        return null;
    }

    public byte[]? GetFont(string faceName)
        => _faceData.TryGetValue(faceName, out var bytes) ? bytes : null;
}
