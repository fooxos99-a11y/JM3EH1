export type GovernanceSectionKey =
  | "governance_board"
  | "governance_board_members"
  | "governance_general_assembly"
  | "governance_general_assembly_members"
  | "governance_general_assembly_minutes"
  | "governance_general_assembly_membership"
  | "governance_licenses"
  | "governance_registration_certificate"
  | "governance_donation_site_certificate"
  | "governance_policies"
  | "governance_committees"
  | "governance_endowments"

export type GovernanceNavItem = {
  label: string
  href: string
  sectionKey?: GovernanceSectionKey
  slug: string[]
  children?: GovernanceNavItem[]
}

export type GovernancePageDefinition = {
  sectionKey: GovernanceSectionKey
  label: string
  href: string
  slug: string[]
  description: string
  parentLabel: string
  childLinks: Array<{ label: string; href: string }>
}

export type GovernanceEditorConfig = {
  overview: string
  showPageSettings?: boolean
  showItemDate?: boolean
  showItemFile?: boolean
  addLabel: string
  itemLabel: string
  itemTitleLabel: string
  itemTitlePlaceholder: string
  itemDescriptionLabel: string
  itemDescriptionPlaceholder: string
  itemDateLabel: string
  itemDatePlaceholder: string
  fileLabel: string
  fileEmptyLabel: string
  fileRemoveLabel: string
  fileUploadLabel: string
  fileUploadingLabel: string
  linkLabel: string
  linkPlaceholder: string
  defaultItem: {
    title: string
    description: string
    date: string
  }
}

export const governanceNavigation: GovernanceNavItem[] = [
  {
    label: "مجلس الإدارة",
    href: "/governance/board",
    sectionKey: "governance_board",
    slug: ["board"],
    children: [
      {
        label: "أعضاء مجلس الإدارة",
        href: "/governance/board/members",
        sectionKey: "governance_board_members",
        slug: ["board", "members"],
      },
    ],
  },
  {
    label: "الجمعية العمومية",
    href: "/governance/general-assembly",
    sectionKey: "governance_general_assembly",
    slug: ["general-assembly"],
    children: [
      {
        label: "أعضاء الجمعية العمومية",
        href: "/governance/general-assembly/members",
        sectionKey: "governance_general_assembly_members",
        slug: ["general-assembly", "members"],
      },
      {
        label: "محاضر الجمعية العمومية",
        href: "/governance/general-assembly/minutes",
        sectionKey: "governance_general_assembly_minutes",
        slug: ["general-assembly", "minutes"],
      },
      {
        label: "طلب عضوية",
        href: "/governance/general-assembly/membership-request",
        sectionKey: "governance_general_assembly_membership",
        slug: ["general-assembly", "membership-request"],
      },
    ],
  },
  {
    label: "التراخيص",
    href: "/governance/licenses",
    sectionKey: "governance_licenses",
    slug: ["licenses"],
    children: [
      {
        label: "شهادة تسجيل الجمعية",
        href: "/governance/licenses/registration-certificate",
        sectionKey: "governance_registration_certificate",
        slug: ["licenses", "registration-certificate"],
      },
      {
        label: "شهادة ترخيص موقع التبرعات",
        href: "/governance/licenses/donation-site-certificate",
        sectionKey: "governance_donation_site_certificate",
        slug: ["licenses", "donation-site-certificate"],
      },
    ],
  },
  {
    label: "السياسات واللوائح",
    href: "/governance/policies",
    sectionKey: "governance_policies",
    slug: ["policies"],
  },
  {
    label: "اللجان",
    href: "/governance/committees",
    sectionKey: "governance_committees",
    slug: ["committees"],
  },
  {
    label: "الأوقاف والاستثمارات",
    href: "/governance/endowments-and-investments",
    sectionKey: "governance_endowments",
    slug: ["endowments-and-investments"],
  },
]

function flattenNavigation(items: GovernanceNavItem[]): GovernanceNavItem[] {
  return items.flatMap((item) => [item, ...(item.children ? flattenNavigation(item.children) : [])])
}

export const governancePages: GovernancePageDefinition[] = flattenNavigation(governanceNavigation).map((item) => ({
  sectionKey: item.sectionKey!,
  label: item.label,
  href: item.href,
  slug: item.slug,
  description: `صفحة ${item.label} ضمن قسم الحوكمة في موقع الجمعية.`,
  parentLabel: item.slug.length > 1
    ? governanceNavigation.find((entry) => entry.href === `/${["governance", item.slug[0]].join("/")}`)?.label ?? "الحوكمة"
    : "الحوكمة",
  childLinks: item.children?.map((child) => ({ label: child.label, href: child.href })) ?? [],
}))

export const governanceSectionKeys = governancePages.map((page) => page.sectionKey)

const defaultGovernanceEditorConfig: GovernanceEditorConfig = {
  overview: "يمكنك تعديل عنوان الصفحة ووصفها، ثم إضافة العناصر أو الملفات التي ستظهر للزوار.",
  showPageSettings: true,
  showItemDate: true,
  showItemFile: true,
  addLabel: "إضافة عنصر",
  itemLabel: "العنصر",
  itemTitleLabel: "العنوان",
  itemTitlePlaceholder: "أدخل عنوان العنصر",
  itemDescriptionLabel: "الوصف",
  itemDescriptionPlaceholder: "أدخل وصفًا مختصرًا لهذا العنصر",
  itemDateLabel: "التاريخ",
  itemDatePlaceholder: "مثال: 15 شعبان 1447",
  fileLabel: "الملف المرفق",
  fileEmptyLabel: "لا يوجد ملف مرفوع",
  fileRemoveLabel: "حذف الملف",
  fileUploadLabel: "رفع ملف",
  fileUploadingLabel: "جارٍ رفع الملف...",
  linkLabel: "أو أدخل رابطًا مباشرًا",
  linkPlaceholder: "https://example.com/file.pdf",
  defaultItem: {
    title: "عنصر جديد",
    description: "وصف مختصر للعنصر",
    date: "",
  },
}

export const governanceEditorConfigs: Record<GovernanceSectionKey, GovernanceEditorConfig> = {
  governance_board: {
    ...defaultGovernanceEditorConfig,
    overview: "خصص هذه الصفحة لعرض قرارات مجلس الإدارة أو ملفات الاجتماعات أو أي وثائق تنظيمية مرتبطة به.",
    addLabel: "إضافة بند لمجلس الإدارة",
    itemLabel: "البند",
    itemTitlePlaceholder: "مثال: قرار مجلس الإدارة رقم 12",
    itemDescriptionPlaceholder: "اكتب ملخص القرار أو البيان أو الوثيقة المرتبطة بمجلس الإدارة",
    defaultItem: {
      title: "قرار جديد",
      description: "ملخص مختصر للقرار أو الوثيقة",
      date: "",
    },
  },
  governance_board_members: {
    ...defaultGovernanceEditorConfig,
    showPageSettings: false,
    showItemDate: false,
    showItemFile: false,
    overview: "أضف أعضاء مجلس الإدارة مع المسمى أو النبذة المختصرة وملف السيرة الذاتية أو القرار إن وجد.",
    addLabel: "إضافة عضو مجلس إدارة",
    itemLabel: "العضو",
    itemTitleLabel: "اسم العضو",
    itemTitlePlaceholder: "مثال: أحمد محمد العتيبي",
    itemDescriptionLabel: "المنصب",
    itemDescriptionPlaceholder: "مثال: رئيس مجلس الإدارة",
    itemDateLabel: "تاريخ الدورة أو التعيين",
    itemDatePlaceholder: "مثال: دورة 1447 هـ أو 2026",
    fileLabel: "ملف العضو أو السيرة الذاتية",
    fileEmptyLabel: "لا يوجد ملف للعضو",
    fileRemoveLabel: "حذف ملف العضو",
    fileUploadLabel: "رفع ملف العضو",
    fileUploadingLabel: "جارٍ رفع ملف العضو...",
    linkLabel: "أو أدخل رابطًا لملف العضو",
    defaultItem: {
      title: "اسم العضو",
      description: "المنصب أو نبذة مختصرة",
      date: "",
    },
  },
  governance_general_assembly: {
    ...defaultGovernanceEditorConfig,
    overview: "اعرض في هذه الصفحة التعريف العام بالجمعية العمومية وقراراتها أو ملفاتها التنظيمية الأساسية.",
    addLabel: "إضافة بند للجمعية العمومية",
    itemLabel: "البند",
    itemTitlePlaceholder: "مثال: إعلان اجتماع الجمعية العمومية",
    itemDescriptionPlaceholder: "اكتب وصفًا للبند أو البيان أو المستند المرتبط بالجمعية العمومية",
    defaultItem: {
      title: "بند جديد",
      description: "وصف مختصر للبند",
      date: "",
    },
  },
  governance_general_assembly_members: {
    ...defaultGovernanceEditorConfig,
    showPageSettings: false,
    showItemDate: false,
    showItemFile: false,
    overview: "أضف أعضاء الجمعية العمومية مع أسمائهم ووصف مختصر أو صفة العضوية والملفات المرتبطة إذا لزم.",
    addLabel: "إضافة عضو جمعية عمومية",
    itemLabel: "العضو",
    itemTitleLabel: "اسم العضو",
    itemTitlePlaceholder: "مثال: خالد بن عبدالله",
    itemDescriptionLabel: "المنصب أو الصفة",
    itemDescriptionPlaceholder: "مثال: عضو عامل أو عضو مؤسس",
    itemDateLabel: "تاريخ الانضمام أو الدورة",
    itemDatePlaceholder: "مثال: 2026 أو دورة 1447 هـ",
    fileLabel: "ملف العضو",
    fileEmptyLabel: "لا يوجد ملف للعضو",
    fileRemoveLabel: "حذف ملف العضو",
    fileUploadLabel: "رفع ملف العضو",
    fileUploadingLabel: "جارٍ رفع ملف العضو...",
    linkLabel: "أو أدخل رابطًا لملف العضو",
    defaultItem: {
      title: "اسم العضو",
      description: "صفة العضوية أو نبذة مختصرة",
      date: "",
    },
  },
  governance_general_assembly_minutes: {
    ...defaultGovernanceEditorConfig,
    showPageSettings: false,
    overview: "استخدم هذه الصفحة لرفع محاضر الاجتماعات مع تواريخها وروابط ملفات PDF أو المستندات الرسمية.",
    addLabel: "إضافة محضر",
    itemLabel: "المحضر",
    itemTitleLabel: "عنوان المحضر",
    itemTitlePlaceholder: "مثال: محضر الاجتماع الأول لعام 2026",
    itemDescriptionLabel: "ملخص المحضر",
    itemDescriptionPlaceholder: "اكتب ملخصًا قصيرًا لمحتوى المحضر أو القرارات الواردة فيه",
    itemDateLabel: "تاريخ الاجتماع",
    itemDatePlaceholder: "مثال: 12 رجب 1447",
    fileLabel: "ملف المحضر",
    fileEmptyLabel: "لا يوجد ملف محضر مرفوع",
    fileRemoveLabel: "حذف ملف المحضر",
    fileUploadLabel: "رفع ملف المحضر",
    fileUploadingLabel: "جارٍ رفع المحضر...",
    linkLabel: "أو أدخل رابط المحضر",
    defaultItem: {
      title: "محضر جديد",
      description: "ملخص مختصر للمحضر",
      date: "",
    },
  },
  governance_general_assembly_membership: {
    ...defaultGovernanceEditorConfig,
    showPageSettings: false,
    overview: "اعرض هنا نموذج طلب العضوية أو تعليماته أو أي ملفات داعمة مرتبطة بالتقديم على العضوية.",
    addLabel: "إضافة طلب أو ملف عضوية",
    itemLabel: "الطلب",
    itemTitleLabel: "عنوان الطلب أو النموذج",
    itemTitlePlaceholder: "مثال: نموذج طلب عضوية الجمعية العمومية",
    itemDescriptionLabel: "تفاصيل الطلب",
    itemDescriptionPlaceholder: "اكتب التعليمات أو المتطلبات أو الوصف المختصر للنموذج",
    itemDateLabel: "تاريخ النشر",
    itemDatePlaceholder: "مثال: محدث في 2026",
    fileLabel: "ملف الطلب أو النموذج",
    fileEmptyLabel: "لا يوجد نموذج مرفوع",
    fileRemoveLabel: "حذف النموذج",
    fileUploadLabel: "رفع نموذج العضوية",
    fileUploadingLabel: "جارٍ رفع النموذج...",
    linkLabel: "أو أدخل رابط طلب العضوية",
    defaultItem: {
      title: "طلب عضوية جديد",
      description: "تعليمات أو وصف مختصر للطلب",
      date: "",
    },
  },
  governance_licenses: {
    ...defaultGovernanceEditorConfig,
    overview: "هذه الصفحة مناسبة لعرض التراخيص العامة أو بياناتها أو الملفات الأساسية ذات الصلة قبل الدخول للصفحات الفرعية.",
    addLabel: "إضافة ترخيص",
    itemLabel: "الترخيص",
    itemTitleLabel: "اسم الترخيص",
    itemTitlePlaceholder: "مثال: ترخيص عام للجمعية",
    itemDescriptionLabel: "وصف الترخيص",
    itemDescriptionPlaceholder: "اكتب نبذة مختصرة عن الترخيص أو نطاقه أو حالته",
    itemDateLabel: "تاريخ الإصدار أو التجديد",
    itemDatePlaceholder: "مثال: صادر بتاريخ 01/01/2026",
    fileLabel: "ملف الترخيص",
    fileEmptyLabel: "لا يوجد ملف ترخيص مرفوع",
    fileRemoveLabel: "حذف ملف الترخيص",
    fileUploadLabel: "رفع ملف الترخيص",
    fileUploadingLabel: "جارٍ رفع ملف الترخيص...",
    linkLabel: "أو أدخل رابط الترخيص",
    defaultItem: {
      title: "ترخيص جديد",
      description: "وصف مختصر للترخيص",
      date: "",
    },
  },
  governance_registration_certificate: {
    ...defaultGovernanceEditorConfig,
    showPageSettings: false,
    overview: "خصص هذه الصفحة لرفع شهادة تسجيل الجمعية أو الإصدارات المحدثة منها مع الوصف والتاريخ.",
    addLabel: "إضافة شهادة تسجيل",
    itemLabel: "الشهادة",
    itemTitleLabel: "عنوان الشهادة",
    itemTitlePlaceholder: "مثال: شهادة تسجيل الجمعية",
    itemDescriptionLabel: "وصف الشهادة",
    itemDescriptionPlaceholder: "اكتب ملاحظات مختصرة عن الشهادة أو نسختها أو اعتمادها",
    itemDateLabel: "تاريخ الشهادة",
    itemDatePlaceholder: "مثال: 2026/04/18",
    fileLabel: "ملف الشهادة",
    fileEmptyLabel: "لا يوجد ملف شهادة مرفوع",
    fileRemoveLabel: "حذف ملف الشهادة",
    fileUploadLabel: "رفع شهادة التسجيل",
    fileUploadingLabel: "جارٍ رفع الشهادة...",
    linkLabel: "أو أدخل رابط الشهادة",
    defaultItem: {
      title: "شهادة تسجيل",
      description: "وصف مختصر للشهادة",
      date: "",
    },
  },
  governance_donation_site_certificate: {
    ...defaultGovernanceEditorConfig,
    showPageSettings: false,
    overview: "اعرض هنا شهادة ترخيص موقع التبرعات وأي مستندات أو تحديثات مرتبطة بها.",
    addLabel: "إضافة شهادة ترخيص",
    itemLabel: "الشهادة",
    itemTitleLabel: "عنوان الشهادة",
    itemTitlePlaceholder: "مثال: شهادة ترخيص موقع التبرعات",
    itemDescriptionLabel: "وصف الشهادة",
    itemDescriptionPlaceholder: "اكتب وصفًا مختصرًا للشهادة أو الملاحظات المرتبطة بها",
    itemDateLabel: "تاريخ الشهادة",
    itemDatePlaceholder: "مثال: مجدد حتى 2027",
    fileLabel: "ملف الشهادة",
    fileEmptyLabel: "لا يوجد ملف شهادة مرفوع",
    fileRemoveLabel: "حذف ملف الشهادة",
    fileUploadLabel: "رفع شهادة الترخيص",
    fileUploadingLabel: "جارٍ رفع الشهادة...",
    linkLabel: "أو أدخل رابط الشهادة",
    defaultItem: {
      title: "شهادة ترخيص",
      description: "وصف مختصر للشهادة",
      date: "",
    },
  },
  governance_policies: {
    ...defaultGovernanceEditorConfig,
    showPageSettings: false,
    overview: "أضف السياسات واللوائح المعتمدة كعناصر مستقلة مع وصف لكل سياسة وملفها المباشر.",
    addLabel: "إضافة سياسة أو لائحة",
    itemLabel: "السياسة",
    itemTitleLabel: "اسم السياسة أو اللائحة",
    itemTitlePlaceholder: "مثال: لائحة الموارد البشرية",
    itemDescriptionLabel: "وصف مختصر",
    itemDescriptionPlaceholder: "اكتب تعريفًا سريعًا بالسياسة أو اللائحة ومجال استخدامها",
    itemDateLabel: "تاريخ الاعتماد",
    itemDatePlaceholder: "مثال: معتمدة في 2026",
    fileLabel: "ملف السياسة أو اللائحة",
    fileEmptyLabel: "لا يوجد ملف مرفوع",
    fileRemoveLabel: "حذف الملف",
    fileUploadLabel: "رفع ملف السياسة",
    fileUploadingLabel: "جارٍ رفع الملف...",
    linkLabel: "أو أدخل رابط السياسة أو اللائحة",
    defaultItem: {
      title: "سياسة جديدة",
      description: "وصف مختصر للسياسة أو اللائحة",
      date: "",
    },
  },
  governance_committees: {
    ...defaultGovernanceEditorConfig,
    showPageSettings: false,
    overview: "عرّف باللجان المعتمدة وأدوارها أو اختصاصاتها وأرفق الملفات أو القرارات المرتبطة بها.",
    addLabel: "إضافة لجنة",
    itemLabel: "اللجنة",
    itemTitleLabel: "اسم اللجنة",
    itemTitlePlaceholder: "مثال: اللجنة التنفيذية",
    itemDescriptionLabel: "اختصاصات اللجنة",
    itemDescriptionPlaceholder: "اكتب وصفًا لمهام اللجنة أو نطاق عملها",
    itemDateLabel: "تاريخ التشكيل",
    itemDatePlaceholder: "مثال: شكلت في 2026",
    fileLabel: "ملف اللجنة أو قرار تشكيلها",
    fileEmptyLabel: "لا يوجد ملف لجنة مرفوع",
    fileRemoveLabel: "حذف ملف اللجنة",
    fileUploadLabel: "رفع ملف اللجنة",
    fileUploadingLabel: "جارٍ رفع ملف اللجنة...",
    linkLabel: "أو أدخل رابط اللجنة",
    defaultItem: {
      title: "لجنة جديدة",
      description: "اختصاصات أو وصف مختصر للجنة",
      date: "",
    },
  },
  governance_endowments: {
    ...defaultGovernanceEditorConfig,
    showPageSettings: false,
    overview: "أضف بيانات الأوقاف والاستثمارات أو الملفات المرتبطة بها بشكل مستقل ومنظم داخل هذه الصفحة.",
    addLabel: "إضافة وقف أو استثمار",
    itemLabel: "العنصر",
    itemTitleLabel: "اسم الوقف أو الاستثمار",
    itemTitlePlaceholder: "مثال: وقف البركة التعليمي",
    itemDescriptionLabel: "الوصف أو الملخص",
    itemDescriptionPlaceholder: "اكتب نبذة مختصرة عن الوقف أو الاستثمار أو حالته الحالية",
    itemDateLabel: "تاريخ التحديث",
    itemDatePlaceholder: "مثال: آخر تحديث 2026",
    fileLabel: "ملف الوقف أو الاستثمار",
    fileEmptyLabel: "لا يوجد ملف مرفوع",
    fileRemoveLabel: "حذف الملف",
    fileUploadLabel: "رفع ملف",
    fileUploadingLabel: "جارٍ رفع الملف...",
    linkLabel: "أو أدخل رابطًا مباشرًا",
    defaultItem: {
      title: "وقف أو استثمار جديد",
      description: "وصف مختصر للعنصر",
      date: "",
    },
  },
}

export function getGovernanceEditorConfig(sectionKey: GovernanceSectionKey) {
  return governanceEditorConfigs[sectionKey]
}

export function getGovernancePageByPath(pathSegments: string[] | undefined) {
  if (!pathSegments || pathSegments.length === 0) {
    return null
  }

  const key = pathSegments.join("/")
  return governancePages.find((page) => page.slug.join("/") === key) ?? null
}

export function getGovernancePageBySection(sectionKey: GovernanceSectionKey) {
  return governancePages.find((page) => page.sectionKey === sectionKey) ?? null
}