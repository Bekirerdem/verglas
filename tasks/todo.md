# Keeper zamanlı işi — GitHub Actions (08-03 onaylı, uygulanmadı)

Keeper ve aggregator artık elle çalıştırılmıyor: günde 6 kez tetiklenen tek bir Actions
job'ı ikisini de koşturuyor. 7/24 sunucu gerekmiyor — `VerglasTreasurer.MAX_PRICE_AGE`
26 saat, keeper'ın 20 dakikalık push eşiği kendi tercihi. Gerekçe ve elenen yollar:
vault `team1-grant/decisions/2026-08-03-keeper-barindirma-github-actions`.

## Kod

- [ ] 1. `keeper/lib.ts` `envKey()` → önce `process.env.PRIVATE_KEY`, yoksa mevcut `.env`
      okuması → doğrula: `PRIVATE_KEY=… npx tsx service.ts --once` `.env` olmadan koşar,
      `.env` ile eski davranış bozulmaz
- [ ] 2. `keeper/service.ts` `--once` exit code'u: bakiye eşiğin altında **veya** oracle
      push gerekliyken başarısız → `exit 1`; boş pencere / sahip beklemesi → `exit 0`
      → doğrula: boş cüzdanla koşu `exit 1`, normal koşu `exit 0`

## CI

- [ ] 3. `.github/workflows/keeper.yml` — `cron: '0 */4 * * *'` + `workflow_dispatch` +
      `concurrency: keeper` (nonce çakışması koruması), timeout 15 dk
- [ ] 4. ZK artifact adımı: `gh release download keeper-artifacts-v1` + `actions/cache`
      → doğrula: cache boşken de job yeşil (CI'da **yeniden derleme yok** — farklı
      trusted setup zincirdeki verifier'ı kırar)
- [ ] 5. Aggregator adımı: amd64 binary indir (cache), arka planda başlat, `:8080` hazır
      olana kadar bekle → doğrula: Echo self-delivery job içinde `isCleared=true` veriyor
- [ ] 6. İki koşu: `VERGLAS_NETWORK=fuji` ve `=avalanche` → doğrula: `workflow_dispatch`
      ile elle tetiklenen ilk koşu uçtan uca yeşil

## Bekir'in elinde (tek seferlik)

- [ ] 7. `cast wallet new` → keeper key üret
- [ ] 8. Fuji + mainnet `VerglasOracle.setKeeper(yeniAdres)` (owner imzası)
- [ ] 9. Gas: Fuji faucet + mainnet ~0.05 AVAX
- [ ] 10. GitHub Secret `KEEPER_PRIVATE_KEY` + `gh release create keeper-artifacts-v1`
      (zkey + wasm)

## Kapsam dışı — bilinçli

`renew.ts` taşınmıyor: `VerglasAccount.agent` immutable, #219'un harcama yetkisi kalıcı
olarak deployer key'inde. Haftalık yenileme yerel kalır. Ayrı izleme servisi yok —
job fail = GitHub'ın otomatik maili.

---

# Tamamlandı (arşiv)

**Konsol: gerçek sayfalara ayırma (07-23)** — hash-router, 5 sayfa (genel bakış/ödemeler/
kurallar/denetim/kişiler), CSV dışa aktarım, büyük pasaport, ~40 i18n anahtarı × 2 dil.
Lokal doğrulandı ve deploy edildi.
