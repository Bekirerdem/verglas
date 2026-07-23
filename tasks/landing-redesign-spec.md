# Verglas Landing Yeniden Tasarım — Spec (07-23, onay bekliyor)

## Karar: Dengeli konumlandırma (Bekir onayı)
Hero moat'ı söyler ("Bir kez kanıtla. Her kapıdan geç."), hemen ardından Haznedar somut dikeyi gösterir, sonra pasaport kendi full-bleed sahnesine yükselir.

## Arketip: Krehel (sinematik)
- Reveal imzası: opacity 0→1 + translateY(16px→0) + blur(6px→0), 480ms power3.out, stagger 80ms
- Canlı veri hücreleri: Kowalski kısıtı — 140ms, opacity + translateY(2px), blur yok
- Scroll: GSAP (trigger timeline'da; scrub'da ease:"none"; prefers-reduced-motion → hepsi görünür)

## Token seti (SABİT — fazlası ihlal)
- Süreler: micro 140ms · section 320ms · sinematik 480ms
- Easing: giriş power3.out · scrub expo/none
- Reveal: y16 + blur6
- Renk: mevcut marka paleti (dark #0e0d0b / #d33f4b, light #f5f2ed / #8b0d1a)

## Layout Anayasası (sayısal)
- İçerik max-width: 1200px (hero full-bleed, iç 1200)
- Bölüm dikey padding: 120px masaüstü / 72px mobil
- Pinned sahne: kontrollü 200vh (eski 2400px keyfi ölü boşluk YOK)
- Tip skala: H1 clamp(3rem,7vw,6rem) BioRhyme · H2 clamp(2rem,4vw,3rem) · gövde 17px Inter · mono etiket 12px IBM Plex Mono +0.08em
- Grid: 12 kolon, gutter 24px
- Tonal odalar: base --paper ↔ raised --paper2 dönüşümlü; PASAPORT odası full-bleed crimson-süpürmeli buz bandı = en parlak sinematik an

## Tonal yolculuk (tez)
Gece buzu (üst) → güven yol aldıkça açılır → pasaport anı en parlak/sinematik → kapanış oturur.

## Bölüm sırası
0 HERO · 01 SORUN · 02 HAZNEDAR · 03 PASAPORT (yeni full-bleed) · 04 NEDEN İNANIRSIN · 05 CANLI+KAPILAR · footer

## Metin: cümleler korunuyor, hero moat'a çevriliyor
- Hero H1: mevcut kullanılmayan "Bir kez kanıtla. / Her kapıdan geç." (hero_l1/l2) aktifleşir
- Hero sub: kasa+kural+ZK kanıt + pasaport başka zincirde (hero_sub_* aktifleşir)
- 01/02/04/05 metinleri aynen korunur; 03 pasaport karttan çıkıp kendi sahnesine
