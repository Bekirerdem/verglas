# Konsol: gerçek sayfalara ayırma (07-23, Bekir onaylı)

Onaylanan spec (değerlendirme raporundaki madde listesi):

- [x] 1. Hash-router: sidebar nav gerçek sayfa değiştirir (#/, #/payments, #/rules, #/audit, #/people); başlık sayfayla değişir; nav-state kopukluğu biter
- [x] 2. Genel bakış: 3 kart + son 6 hareket (kısayol: "tümü → Ödemeler")
- [x] 3. Ödemeler: tam liste + chip filtre + arama + CSV dışa aktarım + tıklanabilir makbuz (Snowtrace) + lokal memo
- [x] 4. Kurallar: kural seti insan dilinde + whitelist isimli + "neden kilitli" + FREN + yeni-kasa köprüsü (Treasurer politika formu ActionDesk'ten buraya taşındı)
- [x] 5. Denetim: pasaport BÜYÜK (Kasa→ZK mühür→Sınır kapısı 3 durak + geçerlilik çubuğu), mühür rafı, "kanıt neyi kanıtlıyor" şeridi, pencereyi yenile
- [x] 6. Kişiler: whitelist + isimlendirme + roller + yeni-kasa köprüsü
- [x] 7. i18n TR/EN yeni anahtarlar (~40 anahtar × 2 dil)
- [x] 8. Build temiz + lokal preview'da 5 sayfa doğrulandı (konsol 0 hata) → deploy

Lokal doğrulama 07-23: payments chips/CSV ✓, rules 4 kart ✓, audit 3-durak pasaport ✓, people 4 kişi ✓, overview limit-6 ✓.

Kurallar: mevcut web2.5 görsel dili DEĞİŞMEZ; veri katmanına dokunulmaz; mevcut kartlar yeniden kullanılır.
