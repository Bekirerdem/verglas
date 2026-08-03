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
