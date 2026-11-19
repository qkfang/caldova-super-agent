// Header dropdowns (<details class="pnav-dd">) behave like a fund site's
// mega-menu: only one open at a time, and they close on outside click,
// on Escape and when a link inside them is followed. Also collapses the
// mobile menu after a link is chosen.
(function () {
    function closeAll(except) {
        document.querySelectorAll('details.pnav-dd[open]').forEach(function (d) {
            if (d !== except) d.removeAttribute('open');
        });
    }

    document.addEventListener('click', function (e) {
        var link = e.target.closest && e.target.closest('.site-header a');
        var dd = e.target.closest && e.target.closest('details.pnav-dd');
        if (link) {
            closeAll(null);
            var toggle = document.getElementById('site-nav-toggle');
            if (toggle) toggle.checked = false;
            return;
        }
        closeAll(dd);
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeAll(null);
    });

    document.addEventListener('toggle', function (e) {
        var d = e.target;
        if (d && d.matches && d.matches('details.pnav-dd') && d.open) closeAll(d);
    }, true);
})();
