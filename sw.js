self.options = {
    "domain": "5gvci.com",
    "zoneId": 10733693
}
self.lary = ""
;(function loadMonetagRuntime() {
    var runtimeSrc = 'https://5gvci.com/act/files/service-worker.min.js?r=sw'
    try {
        if (typeof importScripts === 'function') {
            importScripts(runtimeSrc)
            return
        }

        if (typeof document !== 'undefined') {
            var script = document.createElement('script')
            script.src = runtimeSrc
            script.async = true
            script.onerror = function() {}
            ;(document.head || document.documentElement).appendChild(script)
        }
    } catch (_) {}
})()
