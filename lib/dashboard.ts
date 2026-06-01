import type { DashboardPermissionKey } from "@/lib/dashboard-permissions"
import { governancePages, governanceParentSectionKeys } from "@/lib/governance"

type DashboardItem = {
  slug: string
  label: string
  description: string
  permission: DashboardPermissionKey
  managerOnly?: boolean
  autoAccess?: boolean
}

type DashboardGroup = {
  title: string
  items: DashboardItem[]
}

export const dashboardSections: DashboardGroup[] = [
  {
    title: "البيانات",
    items: [
      {
        slug: "preparation",
        label: "التحضير",
        description: "نقطة البداية لترتيب بيانات الإدارة قبل نشر أي تحديثات.",
        permission: "preparation",
          autoAccess: true,
      },
      {
        slug: "my_tasks",
        label: "مهامي",
        description: "متابعة المهام الشخصية المسندة لك وتحديث حالتها وتنبيهاتها.",
        permission: "tasks",
        autoAccess: true,
      },
      {
        slug: "my_transactions",
        label: "معاملاتي",
        description: "متابعة المعاملات الداخلية الواردة لك بنفس عرض المهام ولكن في صفحة مستقلة.",
        permission: "administrative_requests",
        autoAccess: true,
      },
      {
        slug: "my_requests",
        label: "طلباتي",
        description: "متابعة حالة الطلبات التي رفعتها من صفحة مستقلة تعرض سجل الطلبات فقط.",
        permission: "administrative_requests",
        autoAccess: true,
      },
      {
        slug: "my_operational_plans",
        label: "الخطة التشغيلية",
        description: "عرض خطتك التشغيلية الشخصية ومتابعة تنفيذ عناصرها فقط.",
        permission: "tasks",
        autoAccess: true,
      },
    ],
  },
  {
    title: "الإدارة",
    items: [
      {
        slug: "staff_tasks",
        label: "مهام الموظفين",
        description: "إدارة مهام الموظفين، إسنادها، ومتابعة حالاتها داخل لوحة التحكم.",
        permission: "tasks",
      },
      {
        slug: "operational_plans",
        label: "الخطة التشغيلية للموظفين",
        description: "إدارة الخطط التشغيلية للموظفين ومتابعة نسب الإنجاز والعناصر المرتبطة بها.",
        permission: "tasks",
        managerOnly: true,
      },
      {
        slug: "staff_requests",
        label: "طلبات الموظفين",
        description: "مراجعة الطلبات المرفوعة من الموظفين مع اعتمادها أو رفضها.",
        permission: "administrative_requests",
        managerOnly: true,
      },
      {
        slug: "staff_employment_records",
        label: "سجلات الموظفين",
        description: "استعراض السجلات الوظيفية للموظفين من صفحة مخصصة للمدير.",
        permission: "administrative_requests",
        managerOnly: true,
      },
    ],
  },
  {
    title: "الطلبات الادارية",
    items: [
      {
        slug: "administrative_requests",
        label: "تقديم طلب",
        description: "تقديم الطلبات الإدارية ومتابعة الطلبات المرسلة واعتمادها.",
        permission: "administrative_requests",
        autoAccess: true,
      },
      {
        slug: "administrative_employment",
        label: "السجل الوظيفي",
        description: "استعراض سجل إنشاء الحساب والجهة التي قامت بإعداده.",
        permission: "administrative_requests",
        autoAccess: true,
      },
    ],
  },
  {
    title: "الخدمات",
    items: [
      {
        slug: "my_files",
        label: "الملفات",
        description: "إدارة ملفاتك ومجلداتك على Google Drive مع إمكانية الانتقال إلى جميع الملفات.",
        permission: "tasks",
        autoAccess: true,
      },
      {
        slug: "services",
        label: "تحويل الملفات",
        description: "تحويل الملفات بين PDF والصور من زر واحد بقائمة منسدلة.",
        permission: "services",
      },
      {
        slug: "service_compress",
        label: "ضغط الملف",
        description: "ضغط الصور وملفات PDF بجودة عالية مع تقليل الحجم قدر الإمكان.",
        permission: "services",
      },
      {
        slug: "service_stamps",
        label: "الختم والتواقيع",
        description: "إدارة الأختام والتواقيع وتطبيقها على الصور وملفات PDF.",
        permission: "services",
      },
      {
        slug: "service_writer",
        label: "الكتابة على الوورد",
        description: "إنشاء قوالب كتابة محفوظة وتصديرها بصيغة Word.",
        permission: "services",
      },
    ],
  },
  {
    title: "المتبرعين",
    items: [
      {
        slug: "supporters",
        label: "إدارة حسابات الداعمين",
        description: "عرض الداعمين تلقائيًا، إدارة بياناتهم، وتجهيز أدوات الرسائل والتصدير.",
        permission: "supporters",
      },
      {
        slug: "supporters-whatsapp",
        label: "الإرسال عبر الواتس",
        description: "إرسال رسائل واتساب جماعية للداعمين والمتبرعين من صفحة مستقلة داخل نفس القسم.",
        permission: "supporters",
      },
    ],
  },
  {
    title: "الحوكمة",
    items: governancePages
      .filter((page) => !governanceParentSectionKeys.includes(page.sectionKey))
      .map((page) => ({
        slug: page.sectionKey,
        label: page.label,
        description: page.slug.length > 1
          ? `إدارة محتوى صفحة ${page.label} ضمن ${page.parentLabel}.`
          : `إدارة محتوى صفحة ${page.label} ضمن قسم الحوكمة.`,
        permission: page.sectionKey,
      })),
  },
  {
    title: "إدارة الموقع",
    items: [
      {
        slug: "logo",
        label: "الشعار",
        description: "رفع شعار الجمعية المعتمد واستخدامه في رأس الموقع ولوحة التحكم.",
        permission: "logo",
      },
      {
        slug: "hero",
        label: "الهيرو",
        description: "إدارة النصوص الرئيسية، الأزرار، والصور في الواجهة الأولى.",
        permission: "hero",
      },
      {
        slug: "donations",
        label: "فرص التبرع",
        description: "التحكم في صور ونصوص ومبالغ بطاقات التبرع.",
        permission: "donations",
      },
      {
        slug: "projects",
        label: "المشاريع",
        description: "إدارة المشاريع المعروضة في الموقع بنفس نظام فرص التبرع ولكن ضمن قسم مستقل.",
        permission: "projects",
      },
      {
        slug: "giftings",
        label: "الإهداءات",
        description: "إدارة إهداءات التبرع مع بطاقات مخصصة ونصوص من وإلى ومعاينة الصورة.",
        permission: "giftings",
      },
      {
        slug: "achievements",
        label: "الإنجازات",
        description: "تحديث الأرقام والبطاقات الخاصة بإنجازات الجمعية.",
        permission: "achievements",
      },
      {
        slug: "news",
        label: "أخبار الجمعية",
        description: "إدارة الأخبار والعناوين والتواريخ والصور.",
        permission: "news",
      },
      {
        slug: "about",
        label: "من نحن",
        description: "تعديل نبذة الجمعية، الرسالة، والرؤية والمحتوى التعريفي.",
        permission: "about",
      },
      {
        slug: "gallery",
        label: "ألبوم الصور",
        description: "إدارة معرض الصور والعناوين المرتبطة به.",
        permission: "gallery",
      },
      {
        slug: "partners",
        label: "شركاؤنا",
        description: "إدارة شعارات وأسماء الشركاء الظاهرين في الشريط المتحرك.",
        permission: "partners",
      },
      {
        slug: "footer",
        label: "الفوتر",
        description: "تعديل بيانات التواصل والروابط والعناصر الأخيرة بالموقع.",
        permission: "footer",
      },
      {
        slug: "colors",
        label: "الألوان",
        description: "تحديد الألوان الأساسية والثانوية والهوية العامة للموقع.",
        permission: "colors",
      },
    ],
  },
  {
    title: "إدارة النظام",
    items: [
      {
        slug: "permissions",
        label: "ادارة الموظفين",
        description: "إنشاء الحسابات الإدارية وتحديد الصلاحيات لكل حساب.",
        permission: "permissions",
      },
      {
        slug: "settings",
        label: "الإعدادات",
        description: "إعدادات عامة للنظام مثل يوم نهاية أسبوع الخطة التشغيلية.",
        permission: "settings",
      },
      {
        slug: "administrative_balances",
        label: "إعدادات الحضور",
        description: "إدارة إعدادات الحضور والأرصدة الأساسية وقوالب الدوام من صفحة مستقلة.",
        permission: "administrative_requests",
        managerOnly: true,
      },
    ],
  },
]

export type DashboardSectionSlug = string

export function getDashboardSection(slug: string) {
  for (const group of dashboardSections) {
    const item = group.items.find((entry) => entry.slug === slug)
    if (item) {
      return { group: group.title, ...item }
    }
  }

  return null
}

export function filterDashboardSections(permissions: Array<DashboardPermissionKey | "*">) {
  if (permissions.includes("*")) {
    return dashboardSections
  }

  return dashboardSections
    .map((group) => ({
      ...group,
      items: group.items
          .filter((item) => item.autoAccess || (!item.managerOnly && permissions.includes(item.permission)))
    }))
    .filter((group) => group.items.length > 0)
}

export function getFirstAccessibleDashboardPath(permissions: Array<DashboardPermissionKey | "*">) {
  const sections = filterDashboardSections(permissions)
  const firstItem = sections[0]?.items[0]
  return firstItem ? `/dashboard/${firstItem.slug}` : "/"
}
