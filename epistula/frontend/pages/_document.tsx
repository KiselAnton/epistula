import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* PWA manifest */}
        <link rel="manifest" href="/manifest.json" />
        
        {/* Apple touch icon */}
        <link rel="apple-touch-icon" href="/icon-192.png" />
        
        {/* Theme color for mobile browsers */}
        <meta name="theme-color" content="#007bff" />
        
        {/* Service worker registration - disabled temporarily due to caching issues */}
        {/* 
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) {
                      console.log('ServiceWorker registration successful');
                    },
                    function(err) {
                      console.log('ServiceWorker registration failed: ', err);
                    }
                  );
                });
              }
            `,
          }}
        />
        */}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
