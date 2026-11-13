# Kullanıcı Kabul Testi Senaryoları (F10.3)

Bu senaryolar, platformun **staging ortamında gerçek kullanıcılarla** (en az bir eğitim sorumlusu ve iki–üç
hekim) denenmesi içindir. Amaç, otomatik testlerin göremediklerini görmek: gerçek telefonlar, gerçek e-posta,
gerçek Authenticator uygulaması, ders salonu koşulları ve arayüzün anlaşılırlığı.

**Nasıl kullanılır**

- Önce [`STAGING_CHECKLIST.md`](STAGING_CHECKLIST.md) A–D bölümleri tamamlanmış olmalıdır.
- Her senaryoyu belirtilen rolle uygulayın ve sonucu işaretleyin: **G** (geçti), **K** (kaldı), **A** (atlandı;
  nedenini yazın).
- Ekranda beklenenden farklı bir şey görürseniz senaryoyu "kaldı" sayın ve sondaki şablonla bildirin; küçük
  görünen farklar (anlaşılmayan bir cümle, yanlış yerdeki bir düğme) de değerlidir.
- ⚠ işaretli senaryolar otomatik testlerde **hiç denenemedi** (emülatör desteklemiyor ya da gerçek cihaz
  gerektiriyor); önce bunları yapın.

Katılımcılar: ………………………………………………… Tarih: ……………… Ortam adresi: …………………………

---

## A. Kayıt, giriş ve hesap güvenliği

### A1. Davetsiz kayıt ve onay — hekim + eğitim sorumlusu

1. Hekim: giriş sayfasından kayıt formuna gidin; ünvan, kıdem yılı, ad soyad, e-posta ve şifre girin;
   aydınlatma metnini açıp okuyun, kutuyu işaretleyin; "Başvuruyu gönder".
2. Hekim: sayfayı açık bırakın.
3. Eğitim sorumlusu: Üyeler ve Güvenlik › Üyeler; yeni başvuruyu bulun › İşlemler › "Üyeliği onayla" › onaylayın.

**Beklenen:** 1. adımdan sonra "Başvurunuz onay bekliyor" ekranı; hiçbir modül açılmıyor. 3. adımdan sonra
hekimin ekranı **yenilemeden** kendiliğinden açılıyor. Kutuyu işaretlemeden başvuru gönderilemiyor.

Sonuç: ☐ G ☐ K ☐ A — Not:

### A2. Davet koduyla kayıt — eğitim sorumlusu + hekim

1. Eğitim sorumlusu: Davetler sekmesinde hekimin e-postası için davet oluşturun; çıkan kodu hekime iletin.
2. Hekim: kayıt formunda aynı e-postayı ve davet kodunu girin.
3. Başka bir e-postayla aynı kodu deneyin.

**Beklenen:** 2. adımda onay beklemeden üyelik etkinleşiyor. 3. adımda "Davet kodu geçersiz… ya da bu e-posta
adresine ait değil" hatası; kayıt oluşmuyor. Davet listesinde durum "Kullanıldı".

Sonuç: ☐ G ☐ K ☐ A — Not:

### A3. ⚠ E-posta doğrulama — hekim

1. Kayıttan sonra "Doğrulama e-postası gönder"e basın; gelen kutunuzu (ve istenmeyen klasörünü) kontrol edin.
2. E-postadaki bağlantıya tıklayın; uygulamaya dönüp "Doğruladım"a basın.

**Beklenen:** E-posta birkaç dakika içinde, Türkçe ve kurumsal gönderen adıyla geliyor. Doğrulamadan modüller
açılmıyor; doğruladıktan sonra açılıyor.

Sonuç: ☐ G ☐ K ☐ A — Not:

### A4. ⚠ İki aşamalı doğrulama kurulumu — her kullanıcı

1. İlk girişte yönlendirildiğiniz Hesap güvenliği sayfasında "Kurulumu başlat".
2. Telefonunuzdaki Authenticator uygulamasıyla QR kodu okutun; uygulamadaki 6 haneli kodu girin.
3. Oturum kapanınca e-posta, şifre ve ardından Authenticator koduyla yeniden girin.
4. Çıkış yapıp girişte bilerek yanlış bir kod, sonra bir önceki (süresi geçmiş) kodu deneyin.
5. İkinci adım ekranında 5 dakikadan uzun bekleyip sonra kod girin.

**Beklenen:** Kurulumdan sonra oturum kapanıyor ve giriş kod istiyor. Yanlış ve çok eski kod reddediliyor;
hata mesajı ne yapılacağını söylüyor. Uzun bekleyince baştan giriş isteniyor. Kurulumdan sonra bütün modüller
(yoklama, sınav, materyal) çalışıyor.

Sonuç: ☐ G ☐ K ☐ A — Not:

### A5. ⚠ Şifre sıfırlama — hekim

1. Giriş sayfasında "Şifremi unuttum" › e-postanızı girin › "Sıfırlama bağlantısı gönder".
2. E-postadaki bağlantıyla yeni şifre belirleyin; yeni şifreyle girin.
3. Kayıtlı olmayan bir e-postayla aynı işlemi deneyin.

**Beklenen:** E-posta Türkçe geliyor; yeni şifreyle giriliyor, eskisiyle girilemiyor. 3. adımda ekran, adresin
kayıtlı olup olmadığını **belli etmiyor** (aynı mesaj).

Sonuç: ☐ G ☐ K ☐ A — Not:

### A6. ⚠ Authenticator kaybı — hekim + eğitim sorumlusu

1. Hekim: telefonunu kaybetmiş gibi davranın (Authenticator'daki hesabı silin).
2. Eğitim sorumlusu: hekimin kimliğini doğrulayın; Üyeler › İşlemler › "İki aşamalı doğrulamayı sıfırla".
3. Hekim: e-posta ve şifreyle girin; kurulumu yeniden yapın.

**Beklenen:** Sıfırlamadan sonra hekimin açık oturumları kapanıyor. Hekim kod sorulmadan giriyor ama kurulumu
tamamlamadan modülleri kullanamıyor. Eğitim sorumlusu bunu **kendi** hesabı için yapamıyor.

Sonuç: ☐ G ☐ K ☐ A — Not:

### A7. Hareketsizlik — herkes

1. Giriş yapıp 14 dakika hiçbir şeye dokunmayın.
2. Uyarı çıkınca "Devam et"e basın; sonra 15 dakika daha bekleyin.

**Beklenen:** 14. dakikada geri sayımlı uyarı; "Devam et" oturumu sürdürüyor. 15 dakikada oturum gerçekten
kapanıyor ve giriş ekranı nedenini söylüyor. Sınav çözerken ve projektör ekranında oturum **kapanmıyor**.

Sonuç: ☐ G ☐ K ☐ A — Not:

### A8. Askıya alma anında etkili — hekim + eğitim sorumlusu

1. Hekim giriş yapmış ve bir sayfa açıkken, eğitim sorumlusu hekimi "Askıya al".
2. Hekim yeniden girmeyi denesin; sonra eğitim sorumlusu "Yeniden etkinleştir".

**Beklenen:** Hekimin ekranı birkaç saniye içinde giriş sayfasına düşüyor ve askıya alındığını söylüyor;
giriş yapamıyor. Yeniden etkinleştirince girebiliyor. Kayıtları (sınav, yoklama) duruyor.

Sonuç: ☐ G ☐ K ☐ A — Not:

---

## B. Ders yoklaması

### B1. ⚠ Uygulama içinden QR okutma ve kamera izni — hekim (iPhone Safari **ve** Android Chrome ayrı ayrı)

Açık bir ders yokken eğitim sorumlusundan ders başlatmasını isteyin (B2).

1. Telefonun tarayıcısında giriş yapın; Ders Yoklaması › "QR kodu okut". Tarayıcının kamera iznini **reddedin**.
2. Tarayıcı ayarlarından kamera iznini açın; tekrar "QR kodu okut" › izin verin › projektördeki QR'ı okutun.
3. Kamerayı projektör dışındaki bir QR koduna (ör. bir ürün etiketi) tutun.

**Beklenen:** 1. adımda Türkçe ve anlaşılır bir mesaj ("Kamera izni verilmedi …"); elle kod girme alanı çalışıyor.
2. adımda arka kamera açılıyor; QR okununca kamera kapanıyor ve "Yoklamanız alındı" görünüyor (ayrıca düğmeye
basmak gerekmiyor). 3. adımda "Bu bir Pediatrist yoklama kodu değil." yazıyor ve kamera açık kalıyor.

Telefon modeli / tarayıcı: ……………………… Sonuç: ☐ G ☐ K ☐ A — Not:

### B2. ⚠ Ders başlatma ve projektör — eğitim sorumlusu (ders salonunda)

1. Ders Yoklaması › ders başlığı ve süre girin › "Yoklamayı başlat".
2. "Projektör ekranını aç"; pencereyi projektöre taşıyıp tam ekran yapın.
3. Salonun **en arka sırasından** koda ve QR koda bakın; bir telefonla QR'ı arka sıradan okutmayı deneyin.
4. Kodu 20 saniye izleyin.

**Beklenen:** Kod arka sıradan okunuyor; QR arka sıradan okutulabiliyor. Kod yaklaşık 15 saniyede bir
değişiyor. Projektör bilgisayarı uykuya geçmiyor ve oturum hareketsizlikten kapanmıyor.

Salon / mesafe: ……………………… Sonuç: ☐ G ☐ K ☐ A — Not:

### B3. ⚠ Yoklamaya katılım — hekim

1. Projektördeki QR kodu telefonun **kendi kamera uygulamasıyla** okutun; açılan sayfada kod dolu gelir › "Yoklamaya katıl".
2. Başka bir hekim QR yerine sayfayı elle açıp projektördeki kodu yazarak katılsın.
3. Aynı hekim sayfayı kapatıp yeniden açsın.

**Beklenen:** "Yoklamanız alındı". Eğitim sorumlusunun listesi ve sayaç yenilemeden güncelleniyor. Sayfayı
yeniden açan hekim form yerine "Yoklamanız alındı" görüyor; çift kayıt yok. İşlem hastane kablosuz ağında ve mobil veride
çalışıyor.

Sonuç: ☐ G ☐ K ☐ A — Not:

### B4. ⚠ Yoklamada hile ve hata durumları — iki hekim

1. Hekim A projektördeki kodu salonda olmayan hekim B'ye mesajla göndersin; B kendi hesabıyla
   denesin (20 saniye içinde ve 1 dakika sonra).
2. Hekim A, hekim B'nin hesabına **kendi** telefonundan girmeyi denesin (B'nin şifresini bilse bile).

**Beklenen:** 1 dakika sonraki deneme "Kod geçersiz veya süresi doldu" ile reddediliyor. (20 saniye içindeki
deneme teknik olarak kabul edilebilir; bu durumda eğitim sorumlusu Denetim kayıtlarında katılımın projektörle
**farklı ağdan** geldiğini görebilmelidir.) 2. adımda giriş, B'nin Authenticator kodu olmadan tamamlanmıyor
(iki aşamalı doğrulama). Yoklamada ayrıca cihaz kaydı yoktur (D23).

Sonuç: ☐ G ☐ K ☐ A — Not:

### B5. Mazeret, kapanış ve raporlar — eğitim sorumlusu

1. Canlı listede bir hekime mazeret girin; "Dersi bitir".
2. Raporlarda dersi açın; "Ders raporunu CSV olarak indir"; dosyayı Excel'de açın.
3. Hekimler sekmesinde bir hekimin ders dökümünü açın.

**Beklenen:** Ders kapanınca katılmayanlar "Katılmadı" olarak listeleniyor; mazeretliler katılım oranına
girmiyor. CSV Excel'de sütunlara ayrılmış ve Türkçe karakterler doğru açılıyor. %70'in altındaki hekimler
işaretli.

Sonuç: ☐ G ☐ K ☐ A — Not:

### B6. Yeni telefon — hekim

1. Hekim yeni bir telefonda giriş yapsın (Authenticator kodu ile) ve açık derse katılsın.

**Beklenen:** Ek bir cihaz kaydı istenmiyor; giriş yapan hekim yoklamaya katılabiliyor. Authenticator uygulaması
da yeni telefondaysa ve eskisi kaybolduysa iki aşamalı doğrulama sıfırlaması A bölümündeki gibi yapılır.

Sonuç: ☐ G ☐ K ☐ A — Not:

### B7. Uzman ve öğretim üyesi hesabı — Uzm. Dr. / Doç. Dr. / Prof. Dr. ünvanlı hekim + eğitim sorumlusu

1. Uzm. Dr. ünvanıyla kayıt olun; eğitim sorumlusu onaylasın.
2. Açık bir ders varken menüye ve ana sayfaya bakın; adres çubuğuna `/attendance` yazın.
3. Eğitim sorumlusu dersi bitirsin; Raporlar › Hekimler sekmesine baksın. Üyeler › bu hesabın işlemlerine baksın.

**Beklenen:** Menüde "Ders Yoklaması" yok; ana sayfada canlı ders adımı ve "Derse katılım" göstergesi yok;
`/attendance` "yalnızca 1.–4. yıl asistan hekimler içindir" diyor. Uzman, dersin beklenen listesinde ve
karnede yok; "katılmadı" yazılmıyor. Üye işlemlerinde "Kıdem yılını değiştir" yok.

Sonuç: ☐ G ☐ K ☐ A — Not:

---

## C. Sınavlar

### C1. Sınav hazırlama ve yayınlama — eğitim sorumlusu

1. Sınavlar › Yeni sınav; örnek CSV şablonunu indirin, kendi 3–5 sorunuzla doldurun (en az biri görselli).
2. Görseller sekmesinden görseli yükleyin; CSV'yi seçin; önizlemeyi inceleyin ("Cevap anahtarını göster").
3. Bilerek hatalı bir satır (ör. doğru cevabı seçeneklerde olmayan soru) ekleyip yeniden seçin.
4. Hatayı düzeltin; başlık ve süre girin; "Taslak olarak kaydet" › "Yayınla".

**Beklenen:** Hatalı satır, satır numarası ve anlaşılır bir açıklamayla gösteriliyor; hata varken kayıt
yapılamıyor. Önizleme hekimin göreceği gibi. Yayınlanan sınav hekimlerin ana sayfasında beliriyor.

Sonuç: ☐ G ☐ K ☐ A — Not:

### C2. Sınav çözme ve dayanıklılık — hekim (bir kez bilgisayarda, bir kez telefonda)

1. "Sınava başla"; birkaç soruyu yanıtlayın; görseli büyütün.
2. Sayfayı yenileyin; sonra tarayıcıyı kapatıp yeniden açın ve giriş yapın.
3. İnternet bağlantısını 30 saniye kesip bir yanıt değiştirin; bağlantıyı geri açın.
4. "Sınavı teslim et".

**Beklenen:** Yenileme ve yeniden girişten sonra yanıtlar duruyor ve süre **kaldığı yerden** (sıfırdan değil)
devam ediyor. Bağlantı kesikken yanıtın kaydedilemediği görünüyor; bağlantı gelince kaydediliyor. Teslimden
sonra puan görünüyor.

Sonuç: ☐ G ☐ K ☐ A — Not:

### C3. Süre dolumu — hekim

1. Kısa süreli (ör. 2 dakikalık) bir sınava başlayın; bazı soruları yanıtlayın ve teslim etmeden bekleyin.

**Beklenen:** Son 5 ve son 1 dakikada uyarı. Süre dolunca o ana kadar kaydedilmiş yanıtlar kendiliğinden
teslim ediliyor ve karnede sürenin dolduğu belirtiliyor.

Sonuç: ☐ G ☐ K ☐ A — Not:

### C4. Karne ve cevapların gizliliği — iki hekim + eğitim sorumlusu

1. "Sınav kapanınca" kuralıyla yayınlanmış bir sınavı hekim A teslim etsin; hekim B henüz çözüyor olsun.
2. Hekim A karnesine baksın.
3. Eğitim sorumlusu "Sınavı kapat"; hekim A karnesini yeniden açsın.

**Beklenen:** 2. adımda hekim A puanını ve hangi soruları doğru yaptığını görüyor ama **doğru cevapları ve
açıklamaları görmüyor**. 3. adımdan sonra (ve hekim B'nin süresi bittikten sonra) doğru cevaplar ve öğrenme
noktaları açılıyor.

Sonuç: ☐ G ☐ K ☐ A — Not:

### C5. Sonuç analitiği — eğitim sorumlusu

1. Sınavlar › Sonuçlar; sınavı seçin; soru bazlı doğru oranlarına bakın; bir hekimin karnesini açın.
2. "Sınav sonuçlarını CSV olarak indir"; Hekimler sekmesinde bir hekimin gelişimini açın.

**Beklenen:** Sayılar hekimlerin kendi ekranlarındaki puanlarla aynı. CSV Excel'de doğru açılıyor.

Sonuç: ☐ G ☐ K ☐ A — Not:

---

## D. Eğitim materyalleri

### D1. Yükleme — eğitim sorumlusu

1. Eğitim Materyalleri › "Materyal yükle"; bir PDF seçin; iki etiket yazın (birini daha önce kullanılmış bir
   etiketten seçin), hedef kıdem (biri "Uzman" olsun) ve "zorunlu okuma" seçin › "Yükle ve yayınla".
2. Büyük bir video (ör. 100 MB) yükleyin; yükleme sürerken bir kez iptal edin.
3. Bir PowerPoint dosyası seçmeyi deneyin.

**Beklenen:** İlerleme çubuğu; iptal edince yarım kayıt kalmıyor. PowerPoint reddediliyor ve "sunumu PDF olarak
kaydedin" deniyor. Listede etiketler ve "…, Uzman" görünüyor; aynı etiketi farklı büyük/küçük harfle yazınca
"zaten ekli" uyarısı çıkıyor.

Sonuç: ☐ G ☐ K ☐ A — Not:

### D2. ⚠ Görüntüleme — hekim (bilgisayar ve telefon)

1. Materyali açın; sayfaları çevirin (düğmeler ve klavye ok tuşları).
2. Sayfanın üzerindeki filigrana bakın; bir ekran görüntüsü alın.
3. Son sayfaya gelmeden "Tamamlandı olarak işaretle"yi deneyin; sonra son sayfaya gidip işaretleyin.
4. İndirme izni olan ve olmayan birer materyali karşılaştırın.

**Beklenen:** PDF açılıyor (açılmıyorsa Storage CORS eksiktir). Filigranda **kendi** adınız, e-postanız ve saat
var ve ekran görüntüsünde de görünüyor. Son sayfayı görmeden tamamlandı işaretlenemiyor. "İndir" yalnızca izin
verilen materyalde var.

Sonuç: ☐ G ☐ K ☐ A — Not:

### D3. Okunma raporu — eğitim sorumlusu

1. Materyal listesinde okunma raporunu açın; hekimin D2'deki okuması görünüyor mu?

**Beklenen:** Hedef kıdemdeki hekimler "tamamladı / başladı / başlamadı" olarak listeleniyor; süre ve sayfa
bilgisi gerçek okumayla tutarlı.

Sonuç: ☐ G ☐ K ☐ A — Not:

### D4. Materyal süzgeci ve "Uzman" hedefi — eğitim sorumlusu + Uzm. Dr.

1. Eğitim sorumlusu: Materyaller listesinde "Ara"ya başlıktan bir kelime yazın; sonra bir etiket ve "Uzman"
   hedef kıdemi seçin; "Süzgeci temizle".
2. Uzm. Dr. hesabıyla Eğitim Materyalleri'ni açın.

**Beklenen:** Her süzgeç listeyi daraltıyor, "N / M materyal gösteriliyor" yazıyor, eşleşme yoksa "Bu süzgeçle
materyal yok". Uzmanın kıdem süzgeci "Uzman (benim)"; yalnızca uzman hedefli materyaller görünüyor, "Bütün
kıdemler" ile hepsi. Ana sayfadaki zorunlu materyal sayısı yalnızca uzman hedefli zorunlu materyalleri sayıyor.

Sonuç: ☐ G ☐ K ☐ A — Not:

---

## E. Yönetim ve kişisel veriler

### E1. Ana sayfa "sıradaki iş" — hekim + eğitim sorumlusu

1. Hekim ana sayfası açıkken eğitim sorumlusu sırayla: sınav yayınlasın, ders başlatsın, dersi bitirsin, sınavı
   kapatsın.

**Beklenen:** Hekimin ana sayfasındaki kart her adımda yenilemeden değişiyor ve her seferinde **tek** bir iş
öneriyor (ders varken yoklama, yoksa sınav, yoksa zorunlu materyal). Göstergelerdeki sayılar ilgili sayfalardaki
sayılarla aynı.

Sonuç: ☐ G ☐ K ☐ A — Not:

### E2. Yetki verme ve kaldırma — eğitim sorumlusu

1. Bir hekimi "Eğitim sorumlusu yap" (adını yazarak onaylayın); o hekim yönetim sayfalarını görsün.
2. "Eğitim sorumlusu yetkisini kaldır".
3. Kendi satırınızda rol veya durum değiştirmeyi deneyin.

**Beklenen:** Ad tam yazılmadan onay düğmesi açılmıyor. Yetki kaldırılınca hekimin oturumu kapanıyor ve yönetim
sayfalarına erişemiyor. Kendi satırınızda bu işlemler yok.

Sonuç: ☐ G ☐ K ☐ A — Not:

### E3. Denetim kayıtları — eğitim sorumlusu

1. Denetim kayıtları sekmesinde bugünkü işlemlerinizi bulun; önem ve modül süzgeçlerini deneyin; bir kaydın
   ayrıntısını açın.

**Beklenen:** A–E senaryolarındaki işlemler (onay, sıfırlama, ders, sınav, silme) kim yaptıysa onun adıyla
listede. Eylem adları Türkçe ve anlaşılır. Ayrıntıda "ağ kimliği" var.

Sonuç: ☐ G ☐ K ☐ A — Not:

### E4. Aydınlatma metni onayı — ilk eğitim sorumlusu / metin güncellendiğinde herkes

1. Onayı olmayan (ya da metin sürümü değişmiş) bir hesapla girin.

**Beklenen:** Modüller yerine onay ekranı; metin bağlantısı açılıyor; kutu işaretlenmeden devam edilemiyor;
"Çıkış yap" çalışıyor. Metin henüz hukuk birimince onaylanmadıysa "Taslak metin" uyarısı görünüyor.

Sonuç: ☐ G ☐ K ☐ A — Not:

### E5. Kişisel veri dökümü — hekim + eğitim sorumlusu

1. Hekim: Hesap güvenliği › "Verilerimi indir"; inen dosyayı açın.
2. Eğitim sorumlusu: Üyeler › İşlemler › "Veri dökümünü indir".

**Beklenen:** Dosyada hekimin profili, sınav girişimleri ve kendi yanıtları, yoklama ve materyal kayıtları var;
başkasına ait veri ve sınavların **doğru cevapları yok**. Hekim başka birinin dökümünü alamıyor.

Sonuç: ☐ G ☐ K ☐ A — Not:

### E6. Üye silme — eğitim sorumlusu (yalnızca bir **test** hesabıyla)

1. Sınava girmiş ve yoklamaya katılmış bir test hesabını, o hesap başka bir tarayıcıda açıkken silin (adını
   yazarak).
2. Sınav sonuçlarına ve ders raporuna bakın; silinen hesapla yeniden girmeyi deneyin.

**Beklenen:** Açık oturum "Hesabınız silindi" mesajıyla kapanıyor; yeniden girilemiyor. Raporlarda puan ve
katılım duruyor ama ad yerine "Silinmiş üye" yazıyor; mazeret notu silinmiş. Kritik olay e-postası geliyor
(kontrol listesi E1).

Sonuç: ☐ G ☐ K ☐ A — Not:

### E7. Hesaplayıcılar sayfası — eğitim sorumlusu + hekim

1. Eğitim sorumlusu bir hesaplayıcıya protokol notu eklesin; hekim sayfayı açık tutsun.

**Beklenen:** Sayfa hesaplama yapılmadığını açıkça söylüyor; hiçbir yerde çalışan bir doz hesabı ya da "etkin"
güvenlik kilidi izlenimi yok. Not hekimin ekranında yenilemeden beliriyor.

Sonuç: ☐ G ☐ K ☐ A — Not:

---

## F. Genel kullanım

### F1. Telefonda kullanım — hekim

1. Bütün sayfaları telefonda gezin (menü, tablolar, diyaloglar).

**Beklenen:** Sayfa yana kaymıyor; düğmeler parmakla rahat basılıyor; geniş tablolar kendi içinde kayıyor.

Sonuç: ☐ G ☐ K ☐ A — Not:

### F2. Hata gösterimi — herkes

1. İnternet bağlantısı kesikken bir işlem yapın (ör. mazeret kaydetme, materyal tamamlama).

**Beklenen:** İşlem "başarılı" **görünmüyor**; ne olduğunu ve ne yapılacağını söyleyen Türkçe bir hata çıkıyor.
Bağlantı gelince yeniden denenebiliyor.

Sonuç: ☐ G ☐ K ☐ A — Not:

### F3. Klavye ve ekran okuyucu (isteğe bağlı) — herkes

1. Fare kullanmadan giriş yapıp bir sınavı çözün; mümkünse ekran okuyucuyla bir materyal açın.

**Beklenen:** Odak her zaman görünür; diyaloglar Esc ile kapanıyor; sınavda kalan süre sesli duyuruluyor.

Sonuç: ☐ G ☐ K ☐ A — Not:

---

## Hata bildirme şablonu

```
Senaryo        : (ör. B3, 2. adım)
Rol / hesap    : (hekim / eğitim sorumlusu; e-posta)
Cihaz          : (ör. iPhone 13, Safari 18 / Windows 11, Chrome)
Ne yaptım      :
Ne bekliyordum :
Ne oldu        : (ekrandaki mesajı aynen yazın)
Saat           : (denetim kaydıyla eşleştirmek için)
Ekran görüntüsü: (hasta verisi ve şifre içermemeli)
Önem           : Engelleyici (işi yapamıyorum) / Önemli / Küçük / Öneri
```

## Kabul ölçütü

- ⚠ işaretli senaryoların tamamı en az bir kez denenmiş ve geçmiş olmalı (B1 hem iPhone hem Android'de).
- "Engelleyici" ve "Önemli" hata kalmamalı; "Küçük" hatalar listelenip kabul edilmiş olmalı.
- [`STAGING_CHECKLIST.md`](STAGING_CHECKLIST.md) F bölümündeki kurum kararları verilmiş olmalı.

Onaylayan (eğitim sorumlusu): ……………………… Tarih: ………………
