/**
 * KVKK aydınlatma metni (F3.5). Metin ve sürüm TEK yerde: kayıt formu sürümü gönderir, sunucu
 * (`completeRegistration`) yalnızca güncel sürümü kabul eder ve onayı sürüm + zaman damgasıyla saklar.
 *
 * İçerik, uygulamanın GERÇEKTEN işlediği verilerden türetilmiştir (kod incelemesiyle). Veri sorumlusunun
 * kimliği ve başvuru adresi kuruma özeldir; ortam yapılandırmasından gelir (`NEXT_PUBLIC_KVKK_*`).
 * Yayından önce kurumun KVKK sorumlusu/hukuk birimi metni onaylamalıdır (REVISION_PLAN F10.2, F9.1).
 * Metin değişirse `version` artırılır; mevcut üyelerin yeniden onayı F9.1'de ele alınır.
 */
export const KVKK_NOTICE_VERSION = "1.0";
export const KVKK_NOTICE_EFFECTIVE_DATE = "2026-11-10";

export interface NoticeSection {
  heading: string;
  paragraphs?: string[];
  items?: string[];
}

export const KVKK_NOTICE_SECTIONS: NoticeSection[] = [
  {
    heading: "İşlenen kişisel veriler",
    items: [
      "Kimlik ve iletişim: ad soyad, ünvan, kurumsal e-posta adresi.",
      "Mesleki bilgi: asistanlar için kıdem yılı, platformdaki rolünüz ve üyelik durumunuz.",
      "Hesap güvenliği: şifre (yalnızca kimlik doğrulama hizmetinde, geri döndürülemez biçimde), iki aşamalı doğrulama kaydı, oturum zamanları.",
      "Eğitim kayıtları: ders yoklama kayıtları (zaman, yöntem, mazeret notu), sınav girişimleri, yanıtları ve puanları, eğitim materyali okuma ilerlemesi.",
      "Cihaz bilgisi: yoklamada kullanılan kişisel cihazınızın bağlama özeti (cihazın kendisi veya konumu değil).",
      "Güvenlik kayıtları: yetki değişiklikleri ve güvenlikle ilgili işlemlerin denetim kayıtları.",
    ],
  },
  {
    heading: "İşleme amaçları",
    items: [
      "Kapalı devre eğitim platformuna üyeliğin yürütülmesi ve yetkilendirme,",
      "ders katılımının doğrulanması ve raporlanması,",
      "çevrimiçi sınavların uygulanması, değerlendirilmesi ve kişisel gelişimin izlenmesi,",
      "eğitim materyallerinin paylaşılması ve okunma takibi,",
      "bilgi güvenliğinin sağlanması ve yetkisiz erişimin önlenmesi.",
    ],
  },
  {
    heading: "Toplama yöntemi ve hukuki sebep",
    paragraphs: [
      "Veriler bu platform üzerinden, sizin girdiğiniz bilgilerle ve platformu kullanımınız sırasında elektronik ortamda toplanır. İşleme, KVKK md. 5/2 kapsamında eğitim faaliyetinin yürütülmesi için gerekli olması ve veri sorumlusunun meşru menfaati (bilgi güvenliği) hukuki sebeplerine dayanır.",
    ],
  },
  {
    heading: "Aktarım",
    paragraphs: [
      "Veriler platformun barındırıldığı bulut hizmet sağlayıcısının (Google Cloud / Firebase) Avrupa Birliği'ndeki veri merkezlerinde (europe-west1) saklanır. Kimlik doğrulama hizmeti nedeniyle verilerin yurt dışında işlenmesi söz konusudur; bu aktarım KVKK md. 9'da öngörülen güvencelere dayanılarak yapılır. Veriler bunun dışında üçüncü kişilere aktarılmaz; kanunen yetkili kurumların talebi saklıdır.",
    ],
  },
  {
    heading: "Saklama süresi",
    paragraphs: [
      "Veriler üyeliğiniz süresince ve eğitim kayıtlarının tutulmasını gerektiren süre boyunca saklanır; süre sonunda silinir veya anonim hale getirilir.",
    ],
  },
  {
    heading: "Haklarınız (KVKK md. 11)",
    items: [
      "Kişisel verilerinizin işlenip işlenmediğini öğrenme ve işlenmişse bilgi talep etme,",
      "işlenme amacını ve amaca uygun kullanılıp kullanılmadığını öğrenme,",
      "aktarıldığı üçüncü kişileri bilme,",
      "eksik veya yanlış işlenmişse düzeltilmesini, şartları oluştuğunda silinmesini veya yok edilmesini isteme ve bu işlemlerin aktarılan kişilere bildirilmesini isteme,",
      "otomatik sistemlerle analiz edilmesi sonucu aleyhinize bir sonucun ortaya çıkmasına itiraz etme,",
      "kanuna aykırı işleme nedeniyle zarara uğramanız halinde zararın giderilmesini talep etme.",
    ],
  },
];
