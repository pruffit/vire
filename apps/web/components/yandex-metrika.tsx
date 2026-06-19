'use client';

import Script from 'next/script';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const id = process.env.NEXT_PUBLIC_METRIKA_ID;

function sendHit(referer?: string) {
  if (!id || typeof window === 'undefined' || !('ym' in window)) return;
  // @ts-expect-error ym — глобал Яндекс.Метрики
  window.ym(Number(id), 'hit', window.location.href, {
    title: document.title,
    referer: referer ?? '',
  });
}

// defer:true отключает авто-хит при init; первый hit отправляет onLoad,
// последующие (SPA-навигация) — этот хук.
function useMetrikaPageview() {
  const pathname = usePathname();
  const isFirst = useRef(true);
  const prevUrl = useRef('');

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      prevUrl.current = window.location.href;
      return;
    }
    const referer = prevUrl.current;
    prevUrl.current = window.location.href;
    sendHit(referer);
  }, [pathname]);
}

export function YandexMetrika() {
  useMetrikaPageview();

  if (!id) return null;

  return (
    <>
      <Script
        id="ym-init"
        strategy="afterInteractive"
        onLoad={() => sendHit(document.referrer)}
      >{`
        (function(m,e,t,r,i,k,a){
          m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
          m[i].l=1*new Date();
          for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}
          k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
        })(window,document,"script","https://mc.yandex.ru/metrika/tag.js?id=${id}","ym");
        ym(${id},"init",{
          defer:true,
          webvisor:true,
          clickmap:true,
          accurateTrackBounce:true,
          trackLinks:true
        });
      `}</Script>
      <noscript>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://mc.yandex.ru/watch/${id}`}
            style={{ position: 'absolute', left: '-9999px' }}
            alt=""
          />
        </div>
      </noscript>
    </>
  );
}
