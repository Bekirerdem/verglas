# Açık iş

**Mainnet pasaportları 06 Ağustos'ta doluyor** (#1783, #1784 — Fuji'dekiler 08'inde).
`keeper/renew.ts` Fuji'ye göre yazıldı: #220'nin harcaması treasurer'ın `payFX`
operatörü üzerinden gidiyor, mainnet'te treasurer yok. Mainnet yenilemesinin yolu
ayrıca çözülecek — yoksa vitrindeki ilk mainnet kasası "expired" görünür.

---

# Tamamlandı (arşiv)

**Keeper zamanlı işi — GitHub Actions (08-04, canlı)** — keeper artık kimsenin
bilgisayarına bağlı değil: `.github/workflows/keeper.yml`, günde 6 koşu
(`cron 0 */4 * * *`) + elle tetikleme, `concurrency: keeper`, 15 dk timeout, matrix
`fuji` (aggregator'lı, self-delivery için) + `avalanche` (damga). Anahtar
`PRIVATE_KEY` secret'ından okunuyor (`.env` lokal yedek), `--once` çıkış kodu
kırmızıya dönüyor: ince bakiye (< 0.03 AVAX), gereken oracle push'un başarısızlığı,
ajan hatası, tick çöküşü. İzleme = GitHub'ın hata maili. ZK artifact'ları
`keeper-artifacts-v1` release'inden geliyor, CI'da **asla** yeniden derlenmiyor —
ikinci bir trusted setup zincirdeki verifier'ı kırar.

Keeper cüzdanı `0x6fD261FcC828D11bc404E84b1818Db7A396A7f8D` (deployer anahtarı
GitHub'a girmedi), Fuji `VerglasOracle.setKeeper` → `0x4083f43e…`. İlk yeşil koşu:
actions/runs/30948412525 — aggregator 4 sn'de ayağa kalktı, yeni cüzdan USD/TRY
47.5525 push etti, üç Fuji + iki mainnet ajanı okundu. Gerekçe ve elenen barındırma
yolları: vault `team1-grant/decisions/2026-08-03-keeper-barindirma-github-actions`.

Kapsam dışı bırakıldı: `renew.ts` taşınmıyor (`VerglasAccount.agent` immutable,
#219'un harcama yetkisi kalıcı olarak deployer key'inde), ayrı izleme servisi yok.
Henüz gerçek bir carry denk gelmediği için Echo self-delivery yolu CI içinde
koşmadı — ilk re-carry'de (ya da #219'a bir harcama açıldığında) görülecek.

**Konsol: gerçek sayfalara ayırma (07-23)** — hash-router, 5 sayfa (genel bakış/ödemeler/
kurallar/denetim/kişiler), CSV dışa aktarım, büyük pasaport, ~40 i18n anahtarı × 2 dil.
Lokal doğrulandı ve deploy edildi.
