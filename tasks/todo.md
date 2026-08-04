# Keeper zamanlı işi — GitHub Actions (08-03 onaylı, kod 08-04'te yazıldı)

Keeper ve aggregator artık elle çalıştırılmıyor: günde 6 kez tetiklenen tek bir Actions
job'ı ikisini de koşturuyor. 7/24 sunucu gerekmiyor — `VerglasTreasurer.MAX_PRICE_AGE`
26 saat, keeper'ın 20 dakikalık push eşiği kendi tercihi. Gerekçe ve elenen yollar:
vault `team1-grant/decisions/2026-08-03-keeper-barindirma-github-actions`.

## Kod

- [x] 1. `keeper/lib.ts` `envKey()` → önce `process.env.PRIVATE_KEY`, yoksa `.env`
      → **doğrulandı:** `.env` geçici olarak kaldırılıp `PRIVATE_KEY=…` ile koşuldu,
      verilen anahtarın adresiyle çalıştı; `.env` geri konunca eski davranış aynı
- [x] 2. `keeper/service.ts` `--once` exit code'u → **doğrulandı:** boş cüzdanla `exit 1`,
      normal koşu `exit 0`. Kapsam planın bir adım ötesinde: bakiye ve oracle push'un
      yanı sıra **ajan hatası** (stamp/carry throw) ve tick çöküşü de kırmızı yapar —
      yoksa gerçek bir hata sessizce yeşil geçerdi ve izleme diye bir şey kalmazdı

## CI

- [x] 3. `.github/workflows/keeper.yml` — `cron: '0 */4 * * *'` + `workflow_dispatch` +
      `concurrency: keeper` + timeout 15 dk
- [x] 4. ZK artifact adımı: `actions/cache` + `gh release download keeper-artifacts-v1`
      (CI'da **yeniden derleme yok** — farklı trusted setup zincirdeki verifier'ı kırar).
      Cache-boş yolu ancak release yüklendikten sonra (madde 10) koşulabilir
- [x] 5. Aggregator adımı: amd64 binary (cache) → `--config-file` → `/health` beklenir.
      Yalnız Fuji koşusunda: mainnet'te gate yok. `isCleared=true` doğrulaması gerçek bir
      carry ister — ilk koşudan önce #219'a bir harcama+pencere açılırsa aynı koşuda görülür
- [x] 6. İki koşu: matrix `fuji` + `avalanche`. **Lokal olarak temiz kurulumla** (sıfırdan
      `npm ci`, `.env` yok, `PRIVATE_KEY` env'den) ikisi de `exit 0` verdi; gerçek Actions
      koşusu secret'a bağlı (madde 10)

## Bekir'in elinde (tek seferlik) — sıra sende

- [ ] 7. `cast wallet new` → keeper key üret
- [ ] 8. Fuji + mainnet `VerglasOracle.setKeeper(yeniAdres)` (owner imzası)
- [ ] 9. Gas: Fuji faucet + mainnet ~0.05 AVAX
- [ ] 10. GitHub Secret `KEEPER_PRIVATE_KEY` + `gh release create keeper-artifacts-v1`
      (`build/policy_compliance.zkey` + `build/policy_compliance_js/policy_compliance.wasm`)

Ondan sonra: Actions → Keeper → **Run workflow** → iki job da yeşil olmalı.

## Kapsam dışı — bilinçli

`renew.ts` taşınmıyor: `VerglasAccount.agent` immutable, #219'un harcama yetkisi kalıcı
olarak deployer key'inde. Haftalık yenileme yerel kalır. Ayrı izleme servisi yok —
job fail = GitHub'ın otomatik maili.

---

# Tamamlandı (arşiv)

**Konsol: gerçek sayfalara ayırma (07-23)** — hash-router, 5 sayfa (genel bakış/ödemeler/
kurallar/denetim/kişiler), CSV dışa aktarım, büyük pasaport, ~40 i18n anahtarı × 2 dil.
Lokal doğrulandı ve deploy edildi.
