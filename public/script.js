// ── Public Support Form — Client Logic ─────────────────
// Supports: English, Turkish, Spanish, French, Russian, Arabic, Greek

(function () {
  'use strict';

  // ── Translations ───────────────────────────────────
  const T = {
    en: {
      heading: 'Submit a Support Request',
      supportNav: 'Technical Support',
      subtitle: 'Fill out the form below and our team will get back to you promptly.',
      fullName: 'Full Name', fullNamePh: 'John Doe',
      email: 'Email Address', emailPh: 'john@company.com',
      company: 'Company Name', companyPh: 'Acme Corporation',
      device: 'Device Number', devicePh: 'DEV-12345',
      order: 'Order Number', orderPh: 'ORD-67890',
      purchaseDate: 'Purchase Date',
      subject: 'Issue Subject', subjectPh: 'Brief description of the issue',
      description: 'Issue Description', descriptionPh: "Please provide as much detail as possible about the issue you're experiencing...",
      submitBtn: 'Submit Request',
      successHeading: 'Request Submitted Successfully!',
      successMsg: 'Thank you for reaching out. Our support team will review your request and get back to you shortly.',
      refLabel: 'Your Reference Number',
      successNote: 'Please save this reference number for your records. A confirmation email has been sent to your email address.',
      newTicketBtn: 'Submit Another Request',
      // Validation
      v_required: '{field} is required.',
      v_maxlen: '{field} must be {max} characters or fewer.',
      v_email: 'Please enter a valid email address.',
      v_date: 'Please enter a valid date.',
      v_future: 'Purchase date cannot be in the future.',
      v_error: 'An error occurred while submitting your request. Please try again.',
      // Field names for validation messages
      f_customer_name: 'Full name', f_customer_email: 'Email address',
      f_customer_company: 'Company name', f_device_number: 'Device number',
      f_order_number: 'Order number', f_purchase_date: 'Purchase date',
      f_issue_subject: 'Issue subject', f_issue_description: 'Issue description',
    },
    tr: {
      heading: 'Destek Talebi Oluştur',
      supportNav: 'Teknik Destek',
      subtitle: 'Aşağıdaki formu doldurun, ekibimiz en kısa sürede size geri dönecektir.',
      fullName: 'Ad Soyad', fullNamePh: 'Ahmet Yılmaz',
      email: 'E-posta Adresi', emailPh: 'ahmet@sirket.com',
      company: 'Şirket Adı', companyPh: 'Örnek A.Ş.',
      device: 'Cihaz Numarası', devicePh: 'DEV-12345',
      order: 'Sipariş Numarası', orderPh: 'ORD-67890',
      purchaseDate: 'Satın Alma Tarihi',
      subject: 'Sorun Başlığı', subjectPh: 'Sorunun kısa açıklaması',
      description: 'Sorun Açıklaması', descriptionPh: 'Lütfen yaşadığınız sorunu mümkün olduğunca detaylı açıklayın...',
      submitBtn: 'Talebi Gönder',
      successHeading: 'Talebiniz Başarıyla Gönderildi!',
      successMsg: 'Bizimle iletişime geçtiğiniz için teşekkürler. Destek ekibimiz talebinizi inceleyip en kısa sürede size dönecektir.',
      refLabel: 'Referans Numaranız',
      successNote: 'Lütfen bu referans numarasını kaydedin. E-posta adresinize bir onay mesajı gönderilmiştir.',
      newTicketBtn: 'Yeni Talep Oluştur',
      v_required: '{field} gereklidir.',
      v_maxlen: '{field} en fazla {max} karakter olmalıdır.',
      v_email: 'Lütfen geçerli bir e-posta adresi girin.',
      v_date: 'Lütfen geçerli bir tarih girin.',
      v_future: 'Satın alma tarihi gelecekte olamaz.',
      v_error: 'Talebiniz gönderilirken bir hata oluştu. Lütfen tekrar deneyin.',
      f_customer_name: 'Ad soyad', f_customer_email: 'E-posta adresi',
      f_customer_company: 'Şirket adı', f_device_number: 'Cihaz numarası',
      f_order_number: 'Sipariş numarası', f_purchase_date: 'Satın alma tarihi',
      f_issue_subject: 'Sorun başlığı', f_issue_description: 'Sorun açıklaması',
    },
    es: {
      heading: 'Enviar una Solicitud de Soporte',
      supportNav: 'Soporte Técnico',
      subtitle: 'Complete el formulario a continuación y nuestro equipo se comunicará con usted a la brevedad.',
      fullName: 'Nombre Completo', fullNamePh: 'Juan García',
      email: 'Correo Electrónico', emailPh: 'juan@empresa.com',
      company: 'Nombre de la Empresa', companyPh: 'Empresa S.A.',
      device: 'Número de Dispositivo', devicePh: 'DEV-12345',
      order: 'Número de Pedido', orderPh: 'ORD-67890',
      purchaseDate: 'Fecha de Compra',
      subject: 'Asunto del Problema', subjectPh: 'Breve descripción del problema',
      description: 'Descripción del Problema', descriptionPh: 'Por favor proporcione la mayor cantidad de detalles posible sobre el problema que está experimentando...',
      submitBtn: 'Enviar Solicitud',
      successHeading: '¡Solicitud Enviada con Éxito!',
      successMsg: 'Gracias por contactarnos. Nuestro equipo de soporte revisará su solicitud y le responderá lo antes posible.',
      refLabel: 'Su Número de Referencia',
      successNote: 'Por favor guarde este número de referencia para sus registros. Se ha enviado un correo de confirmación a su dirección de email.',
      newTicketBtn: 'Enviar Otra Solicitud',
      v_required: '{field} es obligatorio.',
      v_maxlen: '{field} debe tener {max} caracteres o menos.',
      v_email: 'Por favor ingrese un correo electrónico válido.',
      v_date: 'Por favor ingrese una fecha válida.',
      v_future: 'La fecha de compra no puede ser futura.',
      v_error: 'Ocurrió un error al enviar su solicitud. Por favor intente de nuevo.',
      f_customer_name: 'Nombre completo', f_customer_email: 'Correo electrónico',
      f_customer_company: 'Nombre de la empresa', f_device_number: 'Número de dispositivo',
      f_order_number: 'Número de pedido', f_purchase_date: 'Fecha de compra',
      f_issue_subject: 'Asunto del problema', f_issue_description: 'Descripción del problema',
    },
    fr: {
      heading: 'Soumettre une Demande de Support',
      supportNav: 'Support Technique',
      subtitle: 'Remplissez le formulaire ci-dessous et notre équipe vous répondra dans les plus brefs délais.',
      fullName: 'Nom Complet', fullNamePh: 'Jean Dupont',
      email: 'Adresse E-mail', emailPh: 'jean@entreprise.fr',
      company: "Nom de l'Entreprise", companyPh: 'Entreprise SA',
      device: "Numéro de l'Appareil", devicePh: 'DEV-12345',
      order: 'Numéro de Commande', orderPh: 'ORD-67890',
      purchaseDate: "Date d'Achat",
      subject: 'Sujet du Problème', subjectPh: 'Brève description du problème',
      description: 'Description du Problème', descriptionPh: 'Veuillez fournir autant de détails que possible sur le problème que vous rencontrez...',
      submitBtn: 'Envoyer la Demande',
      successHeading: 'Demande Envoyée avec Succès !',
      successMsg: 'Merci de nous avoir contactés. Notre équipe de support examinera votre demande et vous répondra dans les plus brefs délais.',
      refLabel: 'Votre Numéro de Référence',
      successNote: 'Veuillez conserver ce numéro de référence pour vos dossiers. Un e-mail de confirmation a été envoyé à votre adresse.',
      newTicketBtn: 'Soumettre une Autre Demande',
      v_required: '{field} est obligatoire.',
      v_maxlen: '{field} doit comporter {max} caractères ou moins.',
      v_email: 'Veuillez saisir une adresse e-mail valide.',
      v_date: 'Veuillez saisir une date valide.',
      v_future: "La date d'achat ne peut pas être dans le futur.",
      v_error: "Une erreur s'est produite lors de l'envoi de votre demande. Veuillez réessayer.",
      f_customer_name: 'Nom complet', f_customer_email: 'Adresse e-mail',
      f_customer_company: "Nom de l'entreprise", f_device_number: "Numéro de l'appareil",
      f_order_number: 'Numéro de commande', f_purchase_date: "Date d'achat",
      f_issue_subject: 'Sujet du problème', f_issue_description: 'Description du problème',
    },
    ru: {
      heading: 'Отправить Запрос в Поддержку',
      supportNav: 'Техническая Поддержка',
      subtitle: 'Заполните форму ниже, и наша команда свяжется с вами в ближайшее время.',
      fullName: 'Полное Имя', fullNamePh: 'Иван Иванов',
      email: 'Электронная Почта', emailPh: 'ivan@kompaniya.ru',
      company: 'Название Компании', companyPh: 'ООО Компания',
      device: 'Номер Устройства', devicePh: 'DEV-12345',
      order: 'Номер Заказа', orderPh: 'ORD-67890',
      purchaseDate: 'Дата Покупки',
      subject: 'Тема Обращения', subjectPh: 'Краткое описание проблемы',
      description: 'Описание Проблемы', descriptionPh: 'Пожалуйста, опишите проблему как можно подробнее...',
      submitBtn: 'Отправить Запрос',
      successHeading: 'Запрос Успешно Отправлен!',
      successMsg: 'Спасибо за обращение. Наша команда поддержки рассмотрит ваш запрос и ответит вам в ближайшее время.',
      refLabel: 'Ваш Номер Обращения',
      successNote: 'Пожалуйста, сохраните этот номер для ваших записей. На ваш адрес электронной почты отправлено подтверждение.',
      newTicketBtn: 'Отправить Новый Запрос',
      v_required: 'Поле «{field}» обязательно.',
      v_maxlen: '«{field}» должно содержать не более {max} символов.',
      v_email: 'Пожалуйста, введите действительный адрес электронной почты.',
      v_date: 'Пожалуйста, введите действительную дату.',
      v_future: 'Дата покупки не может быть в будущем.',
      v_error: 'Произошла ошибка при отправке запроса. Пожалуйста, попробуйте снова.',
      f_customer_name: 'Полное имя', f_customer_email: 'Электронная почта',
      f_customer_company: 'Название компании', f_device_number: 'Номер устройства',
      f_order_number: 'Номер заказа', f_purchase_date: 'Дата покупки',
      f_issue_subject: 'Тема обращения', f_issue_description: 'Описание проблемы',
    },
    ar: {
      heading: 'إرسال طلب دعم',
      supportNav: 'الدعم الفني',
      subtitle: 'يرجى ملء النموذج أدناه وسيقوم فريقنا بالرد عليك في أقرب وقت.',
      fullName: 'الاسم الكامل', fullNamePh: 'أحمد محمد',
      email: 'البريد الإلكتروني', emailPh: 'ahmed@company.com',
      company: 'اسم الشركة', companyPh: 'شركة المثال',
      device: 'رقم الجهاز', devicePh: 'DEV-12345',
      order: 'رقم الطلب', orderPh: 'ORD-67890',
      purchaseDate: 'تاريخ الشراء',
      subject: 'موضوع المشكلة', subjectPh: 'وصف مختصر للمشكلة',
      description: 'وصف المشكلة', descriptionPh: 'يرجى تقديم أكبر قدر ممكن من التفاصيل حول المشكلة التي تواجهها...',
      submitBtn: 'إرسال الطلب',
      successHeading: 'تم إرسال طلبك بنجاح!',
      successMsg: 'شكراً لتواصلك معنا. سيقوم فريق الدعم لدينا بمراجعة طلبك والرد عليك في أقرب وقت.',
      refLabel: 'رقم المرجع الخاص بك',
      successNote: 'يرجى حفظ رقم المرجع هذا لسجلاتك. تم إرسال رسالة تأكيد إلى بريدك الإلكتروني.',
      newTicketBtn: 'إرسال طلب آخر',
      v_required: '{field} مطلوب.',
      v_maxlen: '{field} يجب أن يكون {max} حرف أو أقل.',
      v_email: 'يرجى إدخال بريد إلكتروني صحيح.',
      v_date: 'يرجى إدخال تاريخ صحيح.',
      v_future: 'تاريخ الشراء لا يمكن أن يكون في المستقبل.',
      v_error: 'حدث خطأ أثناء إرسال طلبك. يرجى المحاولة مرة أخرى.',
      f_customer_name: 'الاسم الكامل', f_customer_email: 'البريد الإلكتروني',
      f_customer_company: 'اسم الشركة', f_device_number: 'رقم الجهاز',
      f_order_number: 'رقم الطلب', f_purchase_date: 'تاريخ الشراء',
      f_issue_subject: 'موضوع المشكلة', f_issue_description: 'وصف المشكلة',
    },
    el: {
      heading: 'Υποβολή Αιτήματος Υποστήριξης',
      supportNav: 'Τεχνική Υποστήριξη',
      subtitle: 'Συμπληρώστε την παρακάτω φόρμα και η ομάδα μας θα επικοινωνήσει μαζί σας σύντομα.',
      fullName: 'Ονοματεπώνυμο', fullNamePh: 'Γιάννης Παπαδόπουλος',
      email: 'Διεύθυνση Email', emailPh: 'giannis@etairia.gr',
      company: 'Όνομα Εταιρείας', companyPh: 'Εταιρεία Α.Ε.',
      device: 'Αριθμός Συσκευής', devicePh: 'DEV-12345',
      order: 'Αριθμός Παραγγελίας', orderPh: 'ORD-67890',
      purchaseDate: 'Ημερομηνία Αγοράς',
      subject: 'Θέμα Προβλήματος', subjectPh: 'Σύντομη περιγραφή του προβλήματος',
      description: 'Περιγραφή Προβλήματος', descriptionPh: 'Παρακαλώ δώστε όσο το δυνατόν περισσότερες λεπτομέρειες σχετικά με το πρόβλημα που αντιμετωπίζετε...',
      submitBtn: 'Υποβολή Αιτήματος',
      successHeading: 'Το Αίτημα Υποβλήθηκε Επιτυχώς!',
      successMsg: 'Ευχαριστούμε που επικοινωνήσατε μαζί μας. Η ομάδα υποστήριξης θα εξετάσει το αίτημά σας και θα σας απαντήσει σύντομα.',
      refLabel: 'Αριθμός Αναφοράς σας',
      successNote: 'Παρακαλώ αποθηκεύστε αυτόν τον αριθμό αναφοράς. Ένα email επιβεβαίωσης έχει σταλεί στη διεύθυνσή σας.',
      newTicketBtn: 'Υποβολή Νέου Αιτήματος',
      v_required: 'Το πεδίο «{field}» είναι υποχρεωτικό.',
      v_maxlen: 'Το «{field}» πρέπει να έχει {max} χαρακτήρες ή λιγότερους.',
      v_email: 'Παρακαλώ εισάγετε μια έγκυρη διεύθυνση email.',
      v_date: 'Παρακαλώ εισάγετε μια έγκυρη ημερομηνία.',
      v_future: 'Η ημερομηνία αγοράς δεν μπορεί να είναι στο μέλλον.',
      v_error: 'Παρουσιάστηκε σφάλμα κατά την υποβολή. Παρακαλώ δοκιμάστε ξανά.',
      f_customer_name: 'Ονοματεπώνυμο', f_customer_email: 'Διεύθυνση email',
      f_customer_company: 'Όνομα εταιρείας', f_device_number: 'Αριθμός συσκευής',
      f_order_number: 'Αριθμός παραγγελίας', f_purchase_date: 'Ημερομηνία αγοράς',
      f_issue_subject: 'Θέμα προβλήματος', f_issue_description: 'Περιγραφή προβλήματος',
    },
  };

  let currentLang = localStorage.getItem('support_form_lang') || 'en';

  // ── Language Switching ──────────────────────────────
  const langSelect = document.getElementById('lang-select');

  function t(key) {
    return (T[currentLang] && T[currentLang][key]) || T.en[key] || key;
  }

  function applyLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('support_form_lang', lang);

    // Update text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const text = t(key);
      // Preserve <span class="required">*</span> inside labels
      const req = el.querySelector('.required');
      if (req) {
        el.textContent = text + ' ';
        el.appendChild(req);
      } else {
        el.textContent = text;
      }
    });

    // Update placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.placeholder = t(key);
    });

    // RTL for Arabic
    const isRtl = lang === 'ar';
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.body.classList.toggle('rtl', isRtl);

    // Update HTML lang attribute
    document.documentElement.lang = lang;
  }

  langSelect.value = currentLang;
  langSelect.addEventListener('change', () => {
    applyLanguage(langSelect.value);
  });

  // Apply on load
  applyLanguage(currentLang);

  // ── DOM Refs ───────────────────────────────────────
  const form = document.getElementById('support-form');
  const formCard = document.getElementById('form-card');
  const successCard = document.getElementById('success-card');
  const submitBtn = document.getElementById('submit-btn');
  const ticketRefId = document.getElementById('ticket-ref-id');
  const newTicketBtn = document.getElementById('new-ticket-btn');
  const charCount = document.getElementById('char-count');
  const descriptionField = document.getElementById('issue_description');

  // ── Character Counter ──────────────────────────────
  descriptionField.addEventListener('input', () => {
    charCount.textContent = descriptionField.value.length;
  });

  // ── Localized Validation ───────────────────────────
  function getValidationError(fieldName, value) {
    const fieldLabel = t('f_' + fieldName);

    switch (fieldName) {
      case 'customer_name':
        if (!value.trim()) return t('v_required').replace('{field}', fieldLabel);
        if (value.length > 255) return t('v_maxlen').replace('{field}', fieldLabel).replace('{max}', '255');
        return null;
      case 'customer_email':
        if (!value.trim()) return t('v_required').replace('{field}', fieldLabel);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return t('v_email');
        return null;
      case 'customer_company':
        if (!value.trim()) return t('v_required').replace('{field}', fieldLabel);
        if (value.length > 255) return t('v_maxlen').replace('{field}', fieldLabel).replace('{max}', '255');
        return null;
      case 'device_number':
        if (!value.trim()) return t('v_required').replace('{field}', fieldLabel);
        if (value.length > 100) return t('v_maxlen').replace('{field}', fieldLabel).replace('{max}', '100');
        return null;
      case 'order_number':
        if (!value.trim()) return t('v_required').replace('{field}', fieldLabel);
        if (value.length > 100) return t('v_maxlen').replace('{field}', fieldLabel).replace('{max}', '100');
        return null;
      case 'purchase_date':
        if (!value) return t('v_required').replace('{field}', fieldLabel);
        if (isNaN(new Date(value).getTime())) return t('v_date');
        if (new Date(value) > new Date()) return t('v_future');
        return null;
      case 'issue_subject':
        if (!value.trim()) return t('v_required').replace('{field}', fieldLabel);
        if (value.length > 255) return t('v_maxlen').replace('{field}', fieldLabel).replace('{max}', '255');
        return null;
      case 'issue_description':
        if (!value.trim()) return t('v_required').replace('{field}', fieldLabel);
        if (value.length > 10000) return t('v_maxlen').replace('{field}', fieldLabel).replace('{max}', '10,000');
        return null;
      default:
        return null;
    }
  }

  const fieldNames = [
    'customer_name', 'customer_email', 'customer_company',
    'device_number', 'order_number', 'purchase_date',
    'issue_subject', 'issue_description',
  ];

  // ── Live Validation on Blur ────────────────────────
  fieldNames.forEach((name) => {
    const input = document.getElementById(name);
    const group = document.getElementById(`group-${name}`);
    const errorEl = document.getElementById(`error-${name}`);

    input.addEventListener('blur', () => {
      const error = getValidationError(name, input.value);
      if (error) {
        group.classList.add('error');
        errorEl.textContent = error;
      } else {
        group.classList.remove('error');
        errorEl.textContent = '';
      }
    });

    input.addEventListener('focus', () => {
      group.classList.remove('error');
      errorEl.textContent = '';
    });
  });

  // ── Form Submission ────────────────────────────────
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    let hasErrors = false;
    const payload = {};

    fieldNames.forEach((name) => {
      const input = document.getElementById(name);
      const group = document.getElementById(`group-${name}`);
      const errorEl = document.getElementById(`error-${name}`);
      const error = getValidationError(name, input.value);

      if (error) {
        group.classList.add('error');
        errorEl.textContent = error;
        hasErrors = true;
      } else {
        group.classList.remove('error');
        errorEl.textContent = '';
        payload[name] = input.value.trim();
      }
    });

    if (hasErrors) {
      const firstError = document.querySelector('.form-group.error');
      if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.details && Array.isArray(data.details)) {
          data.details.forEach(({ field, message }) => {
            const group = document.getElementById(`group-${field}`);
            const errorEl = document.getElementById(`error-${field}`);
            if (group && errorEl) {
              group.classList.add('error');
              errorEl.textContent = message;
            }
          });
        } else {
          throw new Error(data.error || 'Submission failed.');
        }
        return;
      }

      ticketRefId.textContent = data.ticket_id;
      formCard.style.display = 'none';
      successCard.classList.remove('hidden');
      successCard.style.animation = 'cardEnter 0.6s cubic-bezier(0.16, 1, 0.3, 1) both';

    } catch (err) {
      console.error('Submission error:', err);
      alert(t('v_error'));
    } finally {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
    }
  });

  // ── Reset Form ─────────────────────────────────────
  newTicketBtn.addEventListener('click', () => {
    form.reset();
    charCount.textContent = '0';

    fieldNames.forEach((name) => {
      const group = document.getElementById(`group-${name}`);
      const errorEl = document.getElementById(`error-${name}`);
      group.classList.remove('error');
      errorEl.textContent = '';
    });

    successCard.classList.add('hidden');
    formCard.style.display = '';
    formCard.style.animation = 'cardEnter 0.6s cubic-bezier(0.16, 1, 0.3, 1) both';
  });
})();
