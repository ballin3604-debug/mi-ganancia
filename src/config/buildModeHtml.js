export function environmentHtmlPlugin(mode, command) {
  return {
    name: 'mg-build-mode-html',
    transformIndexHtml(html) {
      let transformed = html;

      if (mode === 'staging') {
        transformed = transformed
          .replace(/<title>.*?<\/title>/, '<title>[STAGING] Mi Ganancia</title>')
          .replace('</head>', '    <meta name="mg-environment" content="staging" />\n  </head>');
      }

      if (command !== 'build') return transformed;

      const buildMode = String(mode)
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
      const withoutExistingMarker = transformed.replace(
        /<meta\b(?=[^>]*\sname\s*=\s*["']mg-build-mode["'])[^>]*>\s*/gi,
        '',
      );

      return withoutExistingMarker.replace(
        '</head>',
        `    <meta name="mg-build-mode" content="${buildMode}" />\n  </head>`,
      );
    },
  };
}
