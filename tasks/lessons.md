# Verglas — dersler

## 2026-08-03 · "Sürekli çalışmalı" varsayımı koda sorulmadan kurulmaz

**Ne oldu:** "keeper+aggregator'ı kalıcı servis yap" isteği doğrudan *always-on daemon*
diye okundu. VPS + üç systemd unit + `Restart=always` + sessiz-ölüm izleme tasarlandı,
barındırma ve maliyet turu buna göre döndü. Ücretsiz sunucuya güvenilmeyince varsayım
kontrata götürüldü:

- `VerglasTreasurer.sol` → `MAX_PRICE_AGE = 26 hours` (kabul eden tarafın gerçek sınırı)
- `keeper/service.ts` → `PRICE_FRESH_S = 20 dk` (üretenin kendi gas tercihi)
- `web/src/components/*` → fiyatın **yaşı hiç render edilmiyor**, yalnız kuru

Gerçek ihtiyaç "sürekli" değil "günde birkaç kez"di. Sunucu tamamen gereksizdi.

**Kural:** bir işin sıklık/tazelik ihtiyacını sezgiyle belirleme. Sırayla bak — (1)
tüketenin kabul ettiği maksimum yaş sabiti, (2) üretenin kendi eşiği, (3) kullanıcının
fiilen gördüğü alan. İkisi farklıysa gerçek kısıt tüketendedir; gösterilmeyen bayatlık
bayatlık değildir. Tolerans genişse en az bakımlı çözüme in.

**Aynı refleksin ikinci yüzü:** yetki envanterini de koddan çıkar. `submitProof`,
`carryAttestation` ve `receiveCrossChainMessage` permissionless olduğu için otomasyona
deployer key'i gerekmedi — bu okunmasaydı owner key'i bir CI secret'ına yazılacaktı.

## 2026-08-04 · Anahtar rotasyonu tek zincirde bitmez

**Ne oldu:** keeper anahtarı yeni bir cüzdana taşındı, Fuji'ye gas kondu, ilk koşu
yeşil sanıldı. İki tur kayıp: (1) mainnet job'ı `0.0000 AVAX` ile kırmızı — aynı adres,
başka zincir; (2) Fuji koşusu damgayı attı, Echo'ya taşıdı, Warp imzasını topladı ve
teslimde düştü: **gate zinciri kendi native token'ını istiyor**, keeper'ın Echo bakiyesi
sıfırdı.

**Kural:** bir imzalayanı değiştirirken "hangi zincirlerde tx gönderiyor" listesini
koddan çıkar — `TX_FEES` geçen her yazma yolu bir gas hesabıdır. Verglas'ta üç tane:
Fuji C-Chain (damga + oracle push), Avalanche C-Chain (damga), Echo (self-delivery).
Eski anahtarın bakiyeleri yeni anahtara otomatik geçmez; rotasyon = her zincirde
ayrı bir dolum.

**İkinci yüz:** eşik uyarısı yalnız keeper'ın kendi ağını ölçüyor (`pub.getBalance`),
gate zincirini ölçmüyor — o yüzden Echo boşluğu önceden değil, teslim revert'ünde
görüldü. Şimdilik yeterli (hata gürültülü düşüyor), ama sessiz kalmadığı için değil,
`selfDeliver` throw ettiği için yeterli.
