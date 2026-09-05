/**
 * SerenityCare Internationalization (i18n) Engine
 * Supports English and Kiswahili.
 * Language preference is stored INDIVIDUALLY per user in LocalStorage,
 * ensuring each staff member can choose their preferred language without altering others'.
 */

const TRANSLATIONS = {
  en: {
    // Nav & Sections
    nav_dashboard: 'Dashboard & Metrics',
    nav_patients: 'Resident Registry',
    nav_medications: 'Medications (MAR)',
    nav_timetable: 'House Timetable',
    nav_inventory: 'Pharmacy & Store',
    nav_rooms: 'Rooms & Beds',
    nav_certificates: 'Graduation & Release',
    nav_batch_upload: 'Batch CSV Import',
    nav_users: 'Staff & RBAC',
    nav_settings: 'Facility & Cloudflare',
    nav_clinical_ops: 'Clinical Operations',
    nav_logistics: 'Facility & Logistics',
    nav_admin: 'Administration',
    nav_sign_out: 'Sign Out Workstation',
    
    // Header & Actions
    facility_title: 'SerenityCare Recovery Facility',
    clinical_suite: 'Clinical Management Suite',
    check_next_dose: 'Check Next Dose',
    lang_toggle: 'Language',
    hide_sidebar: 'Hide Sidebar',
    show_sidebar: 'Show Sidebar',
    access_denied: 'Access Restricted',
    access_denied_msg: 'You do not have permission to access this module. Please contact the administrator.',

    // Dashboard
    dash_title: 'Clinical Recovery Dashboard',
    dash_subtitle: 'Real-time resident monitoring, medication administration tracking, and recovery milestones overview.',
    dash_census: 'Active Facility Census',
    dash_bed_occupancy: 'Bed Occupancy',
    dash_pending_mar: 'Pending MAR Doses',
    dash_grad_candidates: 'Graduation Candidates',
    dash_inventory_health: 'Inventory Health',
    dash_ready_release: 'ready for release',
    dash_items_threshold: 'items below threshold',
    dash_stages_title: 'Recovery Stage Breakdown',
    dash_admissions_trend: 'Admissions & Successful Releases',
    dash_todays_mar: "Today's Medication Administrations (MAR)",
    dash_todays_schedule: "Today's House Schedule & Routine",

    // Patients
    patient_registry_title: 'Resident Medical Registry',
    patient_registry_subtitle: 'Comprehensive intake dossiers, psychiatric evaluations, and progress tracking',
    admit_new_resident: 'Admit New Resident',
    admit_first_resident: 'Admit First Resident',
    batch_csv_upload: 'Batch CSV Upload',
    all_residents: 'All Residents',
    search_residents: 'Search name, ID, substance...',
    no_residents_found: 'No Residents Registered Yet',
    no_residents_desc: 'Get started by admitting your first resident or import records in batch via CSV.',
    edit_resident: 'Edit Resident Profile',
    delete_resident: 'Delete Resident',
    clinical_dossier: 'Clinical Dossier',
    print_dossier_pdf: 'Dossier PDF',
    print_cert: 'Print Certificate',
    sobriety_streak: 'Sobriety Streak',
    days_sober: 'Days Sober',
    assigned_room: 'Assigned Room & Bed',
    next_of_kin: 'Next of Kin',
    primary_substance: 'Primary Addiction',

    // Medications
    mar_title: 'Medication Administration Record (MAR)',
    mar_subtitle: 'Supervised clinical dose delivery, scheduled verification, and active prescriptions',
    test_reminder: 'Test Audio/Visual Reminder',
    prescribe_med: 'Prescribe Medication',
    pending_doses: 'Pending Doses Today',
    given_doses: 'Successfully Given',
    refused_doses: 'Refused / Missed',
    administer: 'Administer',
    active_prescriptions: 'Active Medical Prescriptions Across All Residents',

    // Inventory
    inv_title: 'Facility Store & Pharmacy Inventory',
    inv_subtitle: 'Track medication stocks, clinical diagnostics, recovery literature, and usage audits',
    print_inv_report: 'Print Inventory Audit Report',
    add_store_item: 'Add Store Item',
    total_items: 'Total Cataloged Items',
    low_stock_alerts: 'Low Stock Alerts',
    total_inv_value: 'Total Inventory Value',
    restock: '+ Restock',
    dispense: '- Dispense',

    // Timetable
    tt_title: 'Recovery House Schedule & Timetable',
    tt_subtitle: 'Structured daily curriculum, therapy groups, 12-step meetings, and chores',
    print_timetable: 'Print House Timetable',
    add_schedule_event: 'Add Timetable Event',

    // Certificates
    cert_title: 'Graduation & Release Certification',
    cert_subtitle: 'Authorize residents who have satisfied all clinical milestones and print official Certificates of Sobriety & Release.',
    qualified_release: 'Qualified for Release',
    alumni_graduated: 'Alumni Graduated',
    mark_qualified: 'Mark Qualified',
    review_status: 'Review Status',

    // Users
    users_title: 'Staff & User Management',
    users_subtitle: 'Manage clinical staff accounts, assign operational roles, and enforce security policies',
    add_staff_member: 'Add Staff Member',
    edit_staff_member: 'Edit Staff Profile & Permissions',
    delete_staff_member: 'Delete Account',
    manage_permissions: 'Assign or Remove Permissions',

    // Permissions
    perm_dashboard: 'Dashboard & Metrics',
    perm_patients: 'Resident Registry',
    perm_medications: 'Medications (MAR)',
    perm_timetable: 'House Timetable',
    perm_inventory: 'Pharmacy & Store',
    perm_rooms: 'Rooms & Beds',
    perm_certificates: 'Graduation & Release',
    perm_batch_upload: 'Batch CSV Import',
    perm_users: 'Staff & RBAC',
    perm_settings: 'Facility & Settings',

    // Common Buttons
    btn_cancel: 'Cancel',
    btn_save: 'Save Changes',
    btn_confirm: 'Confirm',
    btn_delete: 'Delete',
    btn_edit: 'Edit',
    currency_label: 'TZS'
  },

  sw: {
    // Nav & Sections
    nav_dashboard: 'Dashibodi & Vipimo',
    nav_patients: 'Orodha ya Wakazi',
    nav_medications: 'Utoaji Dawa (MAR)',
    nav_timetable: 'Ratiba ya Nyumba',
    nav_inventory: 'Famasi & Stoo',
    nav_rooms: 'Vyumba na Vitanda',
    nav_certificates: 'Mahafali & Kuachiliwa',
    nav_batch_upload: 'Ingiza CSV kwa Wingi',
    nav_users: 'Wafanyakazi & Ruhusa',
    nav_settings: 'Kituo & Mipangilio',
    nav_clinical_ops: 'Shughuli za Kliniki',
    nav_logistics: 'Kituo & Vifaa',
    nav_admin: 'Utawala',
    nav_sign_out: 'Ondoka Kwenye Mfumo',

    // Header & Actions
    facility_title: 'Kituo cha Marekebisho cha SerenityCare',
    clinical_suite: 'Mfumo wa Usimamizi wa Afya',
    check_next_dose: 'Kagua Dozi Ifuatayo',
    lang_toggle: 'Lugha',
    hide_sidebar: 'Ficha Menyu',
    show_sidebar: 'Onyesha Menyu',
    access_denied: 'Huna Ruhusa',
    access_denied_msg: 'Huna idhini ya kutumia sehemu hii. Tafadhali wasiliana na Msimamizi Mkuu.',

    // Permissions
    perm_dashboard: 'Dashibodi & Vipimo',
    perm_patients: 'Orodha ya Wakazi',
    perm_medications: 'Utoaji Dawa (MAR)',
    perm_timetable: 'Ratiba ya Nyumba',
    perm_inventory: 'Famasi & Stoo',
    perm_rooms: 'Vyumba na Vitanda',
    perm_certificates: 'Mahafali & Kuachiliwa',
    perm_batch_upload: 'Ingiza CSV kwa Wingi',
    perm_users: 'Wafanyakazi & Ruhusa',
    perm_settings: 'Kituo & Mipangilio',

    // Dashboard
    dash_title: 'Dashibodi ya Maendeleo ya Kliniki',
    dash_subtitle: 'Ufuatiliaji wa wakazi papo kwa papo, usimamizi wa dawa, na hatua za kupona uraibu.',
    dash_census: 'Wakazi Waliopo Kituoni',
    dash_bed_occupancy: 'Nafasi za Vitanda',
    dash_pending_mar: 'Dozi Zinazosubiriwa',
    dash_grad_candidates: 'Wanaotarajia Kuhitimu',
    dash_inventory_health: 'Hali ya Vifaa & Stoo',
    dash_ready_release: 'tayari kuachiliwa',
    dash_items_threshold: 'vifaa viko chini ya kiwango',
    dash_stages_title: 'Mgawanyo wa Hatua za Kupona',
    dash_admissions_trend: 'Waliopokewa & Waliohitimu',
    dash_todays_mar: 'Utoaji wa Dawa wa Leo (MAR)',
    dash_todays_schedule: 'Ratiba na Shughuli za Nyumba Leo',

    // Patients
    patient_registry_title: 'Rejesta ya Wakazi wa Kituo',
    patient_registry_subtitle: 'Taarifa kamili za wagonjwa, tathmini ya kisaikolojia, na ripoti za kila siku',
    admit_new_resident: 'Sajili Mkazi Mpya',
    admit_first_resident: 'Sajili Mkazi wa Kwanza',
    batch_csv_upload: 'Ingiza kwa Wingi (CSV)',
    all_residents: 'Wakazi Wote',
    search_residents: 'Tafuta jina, namba, aina ya uraibu...',
    no_residents_found: 'Hakuna Mkazi Aliyesajiliwa Bado',
    no_residents_desc: 'Anza kwa kumsajili mkazi wa kwanza au ingiza taarifa nyingi kupitia faili la CSV.',
    edit_resident: 'Hariri Taarifa za Mkazi',
    delete_resident: 'Futa Mkazi',
    clinical_dossier: 'Faili la Mkazi',
    print_dossier_pdf: 'Faili la PDF',
    print_cert: 'Chapisha Cheti',
    sobriety_streak: 'Muda wa Usafi',
    days_sober: 'Siku Bila Uraibu',
    assigned_room: 'Chumba & Kitanda',
    next_of_kin: 'Mlezi / Ndugu wa Karibu',
    primary_substance: 'Uraibu Mkuu',

    // Medications
    mar_title: 'Kumbukumbu ya Utoaji Dawa (MAR)',
    mar_subtitle: 'Usimamizi wa unywaji dawa chini ya uangalizi wa wauguzi na maelekezo ya daktari',
    test_reminder: 'Jaribu Kengele ya Kikumbusho',
    prescribe_med: 'Andika Dawa Mpya',
    pending_doses: 'Dozi Zinazosubiriwa Leo',
    given_doses: 'Zilizotolewa Kikamilifu',
    refused_doses: 'Zilizokataliwa / Kukosa',
    administer: 'Toa Dawa',
    active_prescriptions: 'Dawa Zilizoidhinishwa na Madaktari',

    // Inventory
    inv_title: 'Stoo ya Vifaa na Famasi ya Kituo',
    inv_subtitle: 'Kumbukumbu za dawa, vipimo vya haraka, vitabu vya hatua 12, na ukaguzi wa matumizi',
    print_inv_report: 'Chapisha Ripoti ya Ukaguzi wa Stoo',
    add_store_item: 'Ongeza Kifaa/Dawa Mpya',
    total_items: 'Jumla ya Vitu Kwenye Stoo',
    low_stock_alerts: 'Onyo la Vitu Vilivyopungua',
    total_inv_value: 'Thamani Kamili ya Stoo',
    restock: '+ Ongeza Mzigo',
    dispense: '- Toa Kifaa/Dawa',

    // Timetable
    tt_title: 'Ratiba ya Shughuli za Nyumba',
    tt_subtitle: 'Mpangilio wa mafunzo ya kila siku, tiba ya vikundi, mikutano ya hatua 12, na usafi',
    print_timetable: 'Chapisha Ratiba ya Nyumba',
    add_schedule_event: 'Ongeza Shughuli Kwenye Ratiba',

    // Certificates
    cert_title: 'Vyeti vya Kuhitimu na Kuachiliwa Huru',
    cert_subtitle: 'Uidhinishaji rasmi wa wakazi waliokidhi vigezo vyote vya kimatibabu na siku za usafi.',
    qualified_release: 'Wanaostahili Kuachiliwa',
    alumni_graduated: 'Waliohitimu (Alumni)',
    mark_qualified: 'Weka Anastahili',
    review_status: 'Kagua Hali Yake',

    // Users
    users_title: 'Wafanyakazi & Usimamizi wa Ruhusa',
    users_subtitle: 'Dhibiti akaunti za wafanyakazi, ruhusa za majukumu, na usalama wa mfumo',
    add_staff_member: 'Sajili Mfanyakazi Mpya',
    edit_staff_member: 'Hariri Mfanyakazi & Ruhusa',
    delete_staff_member: 'Futa Akaunti',
    manage_permissions: 'Weka au Ondoa Ruhusa',

    // Common Buttons
    btn_cancel: 'Ghairi',
    btn_save: 'Hifadhi Mabadiliko',
    btn_confirm: 'Thibitisha',
    btn_delete: 'Futa',
    btn_edit: 'Hariri',
    currency_label: 'TZS'
  }
};

class I18nManager {
  constructor() {
    this.currentLang = 'en';
  }

  /**
   * Get language preference for a specific user ID
   * Guarantees individual user preference without affecting other users
   */
  getUserLang(userId) {
    if (!userId) return 'en';
    return localStorage.getItem(`serenitycare_lang_${userId}`) || 'en';
  }

  setUserLang(userId, lang) {
    if (!userId) return;
    this.currentLang = lang === 'sw' ? 'sw' : 'en';
    localStorage.setItem(`serenitycare_lang_${userId}`, this.currentLang);
    document.documentElement.lang = this.currentLang;
  }

  initForUser(userId) {
    this.currentLang = this.getUserLang(userId);
    document.documentElement.lang = this.currentLang;
  }

  getLang() {
    return this.currentLang;
  }

  t(key, defaultVal = '') {
    const langDict = TRANSLATIONS[this.currentLang] || TRANSLATIONS.en;
    if (langDict && langDict[key]) return langDict[key];
    if (TRANSLATIONS.en && TRANSLATIONS.en[key]) return TRANSLATIONS.en[key];
    return defaultVal || key;
  }

  translatePage(rootElement = document) {
    if (!rootElement) return;
    const elements = rootElement.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        const text = this.t(key);
        if (text) el.textContent = text;
      }
    });

    const placeholders = rootElement.querySelectorAll('[data-i18n-placeholder]');
    placeholders.forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) {
        const text = this.t(key);
        if (text) el.placeholder = text;
      }
    });
  }

  formatCurrency(amount) {
    const num = parseFloat(amount) || 0;
    // Format in TZS with thousand separators
    const formatted = num.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
    return `TZS ${formatted}`;
  }
}

window.I18n = new I18nManager();
