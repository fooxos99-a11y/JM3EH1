import type { DashboardPermissionKey } from "@/lib/dashboard-permissions"
import { governancePages } from "@/lib/governance"

type DashboardItem = {
  slug: DashboardPermissionKey
  label: string
  description: string
  permission: DashboardPermissionKey
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
      },
      {
        slug: "tasks",
        label: "المهام",
        description: "إدارة المهام الموكلة ومتابعة حالتها والتنبيهات المرتبطة بها داخل لوحة التحكم.",
        permission: "tasks",
      },
      {
        slug: "staff_achievements",
        label: "إنجازات الموظفين",
        description: "متابعة إنجازات الموظفين الأسبوعية ورفعها وعرضها بشكل مرتب حسب الأسبوع.",
        permission: "staff_achievements",
      },
    ],
  },
  {
    title: "الخدمات",
    items: [
      {
        slug: "administrative_requests",
        label: "الطلبات الإدارية",
        description: "إدارة الطلبات الإدارية، السجلات الوظيفية، وأرصدة الإجازات والأذونات.",
        permission: "administrative_requests",
      },
      {
        slug: "services",
        label: "الخدمات",
        description: "أدوات تحويل الملفات، تعديل PDF، الأختام والتواقيع، وقوالب الكتابة الجاهزة.",
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
    ],
  },
  {
    title: "الحوكمة",
    items: governancePages
      .filter((page) => page.sectionKey !== "governance_board" && page.sectionKey !== "governance_general_assembly")
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
        label: "الصلاحيات",
        description: "إنشاء الحسابات الإدارية وتحديد الصلاحيات لكل حساب.",
        permission: "permissions",
      },
    ],
  },
]

export type DashboardSectionSlug = DashboardPermissionKey

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
      items: group.items.filter((item) => permissions.includes(item.permission)),
    }))
    .filter((group) => group.items.length > 0)
}

export function getFirstAccessibleDashboardPath(permissions: Array<DashboardPermissionKey | "*">) {
  const sections = filterDashboardSections(permissions)
  const firstItem = sections[0]?.items[0]
  return firstItem ? `/dashboard/${firstItem.slug}` : "/"
}
