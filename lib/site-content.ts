import "server-only"

import { unstable_noStore as noStore } from "next/cache"
import { z } from "zod"

import { dashboardPermissionKeys, type DashboardPermissionKey } from "@/lib/dashboard-permissions"
import { governanceSectionKeys } from "@/lib/governance"
import { createSupabaseAdminClient } from "@/lib/supabase/server"

const imageSchema = z.string()

const heroSlideSchema = z.object({
  id: z.number(),
  image: imageSchema,
  title: z.string(),
  subtitle: z.string(),
  description: z.string(),
})

export const heroContentSchema = z.object({
  slides: z.array(heroSlideSchema),
  donateLabel: z.string(),
  aboutLabel: z.string(),
})

export const donationMethodSchema = z.enum(["shares", "open_restricted", "open_unrestricted"])

export const donationLabelSchema = z.object({
  id: z.number(),
  label: z.string(),
  amount: z.number().nonnegative().default(0),
  sharesCount: z.number().int().min(1).default(1),
})

export const donationItemBaseSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  amount: z.number().nonnegative().default(0),
  image: imageSchema,
  badge: z.string(),
  buttonLabel: z.string(),
  donationMethod: donationMethodSchema.default("shares"),
  minAmount: z.number().nonnegative().default(0),
  maxAmount: z.number().nullable().default(null),
  defaultAmount: z.number().nonnegative().default(0),
  totalAmount: z.number().nonnegative().default(0),
  collectedAmount: z.number().nonnegative().default(0),
  hideTotalAmount: z.boolean().default(false),
  hideDonation: z.boolean().default(false),
  shareUnitAmount: z.number().nonnegative().default(0),
  labels: z.array(donationLabelSchema).default([]),
})

export const donationItemSchema = donationItemBaseSchema.transform((item) => {
  const fallbackAmount = item.amount || item.defaultAmount || item.shareUnitAmount || 100
  const shareUnitAmount = item.donationMethod === "shares"
    ? item.shareUnitAmount || item.amount || Math.max(1, Math.round(item.defaultAmount || 100))
    : 0

  const labels = item.labels.length > 0
    ? item.labels.map((label, index) => {
        const sharesCount = Math.max(1, label.sharesCount || 1)
        const amount = item.donationMethod === "shares"
          ? shareUnitAmount * sharesCount
          : label.amount || item.defaultAmount || fallbackAmount

        return {
          id: label.id || index + 1,
          label: label.label,
          sharesCount,
          amount,
        }
      })
    : [
        {
          id: 1,
          label: item.donationMethod === "shares" ? "سهم واحد" : "تبرع عام",
          sharesCount: 1,
          amount: item.donationMethod === "shares" ? shareUnitAmount : fallbackAmount,
        },
      ]

  const primaryAmount = labels[0]?.amount ?? fallbackAmount
  const defaultAmount = item.defaultAmount || primaryAmount
  const minAmount = item.donationMethod === "open_unrestricted"
    ? 0
    : item.minAmount || defaultAmount
  const maxAmount = item.donationMethod === "open_restricted"
    ? Math.max(minAmount, item.maxAmount ?? defaultAmount)
    : null
  const totalAmount = Math.max(0, item.totalAmount || 0)
  const collectedAmount = item.donationMethod === "open_restricted"
    ? Math.min(Math.max(0, item.collectedAmount || 0), totalAmount || item.collectedAmount || 0)
    : 0

  return {
    ...item,
    amount: primaryAmount,
    shareUnitAmount,
    labels,
    defaultAmount,
    minAmount,
    maxAmount,
    totalAmount,
    collectedAmount,
  }
})

export const donationsContentSchema = z.object({
  badge: z.string(),
  title: z.string(),
  highlight: z.string(),
  description: z.string(),
  items: z.array(donationItemSchema),
})

export const projectsContentSchema = donationsContentSchema

export const giftingTextPlacementSchema = z.object({
  x: z.number().min(0).max(100).default(50),
  y: z.number().min(0).max(100).default(50),
  color: z.string().default("#ffffff"),
  fontSize: z.number().min(12).max(64).default(24),
})

export const giftingItemSchema = donationItemBaseSchema.extend({
  senderPlacement: giftingTextPlacementSchema.default({ x: 28, y: 72, color: "#ffffff", fontSize: 24 }),
  recipientPlacement: giftingTextPlacementSchema.default({ x: 72, y: 72, color: "#ffffff", fontSize: 24 }),
  senderPrefix: z.string().default("من"),
  recipientPrefix: z.string().default("إلى"),
  smsTemplate: z.string().default("وصلتك هدية من {from_name} إلى {to_name} في إهداء {gift_title}. نسأل الله أن يجعلها مباركة."),
  confirmationMessage: z.string().default("تم تجهيز الإهداء، وسيتم إشعار المُهدى له برسالة نصية بعد إتمام الربط مع مزود الرسائل."),
}).transform((item) => {
  const fallbackAmount = item.amount || item.defaultAmount || item.shareUnitAmount || 100
  const shareUnitAmount = item.donationMethod === "shares"
    ? item.shareUnitAmount || item.amount || Math.max(1, Math.round(item.defaultAmount || 100))
    : 0

  const labels = item.labels.length > 0
    ? item.labels.map((label, index) => {
        const sharesCount = Math.max(1, label.sharesCount || 1)
        const amount = item.donationMethod === "shares"
          ? shareUnitAmount * sharesCount
          : label.amount || item.defaultAmount || fallbackAmount

        return {
          id: label.id || index + 1,
          label: label.label,
          sharesCount,
          amount,
        }
      })
    : [
        {
          id: 1,
          label: item.donationMethod === "shares" ? "سهم واحد" : "إهداء عام",
          sharesCount: 1,
          amount: item.donationMethod === "shares" ? shareUnitAmount : fallbackAmount,
        },
      ]

  const primaryAmount = labels[0]?.amount ?? fallbackAmount
  const defaultAmount = item.defaultAmount || primaryAmount
  const minAmount = item.donationMethod === "open_unrestricted" ? 0 : item.minAmount || defaultAmount
  const maxAmount = item.donationMethod === "open_restricted" ? Math.max(minAmount, item.maxAmount ?? defaultAmount) : null
  const totalAmount = Math.max(0, item.totalAmount || 0)
  const collectedAmount = item.donationMethod === "open_restricted" ? Math.min(Math.max(0, item.collectedAmount || 0), totalAmount || item.collectedAmount || 0) : 0

  return {
    ...item,
    amount: primaryAmount,
    shareUnitAmount,
    labels,
    defaultAmount,
    minAmount,
    maxAmount,
    totalAmount,
    collectedAmount,
  }
})

export const giftingsContentSchema = z.object({
  badge: z.string(),
  title: z.string(),
  highlight: z.string(),
  description: z.string(),
  dialogDescription: z.string(),
  senderNameLabel: z.string(),
  senderNamePlaceholder: z.string(),
  recipientNameLabel: z.string(),
  recipientNamePlaceholder: z.string(),
  recipientPhoneLabel: z.string(),
  recipientPhonePlaceholder: z.string(),
  previewTitle: z.string(),
  submitButtonLabel: z.string(),
  smsHelperText: z.string(),
  items: z.array(giftingItemSchema),
})

export const achievementItemSchema = z.object({
  id: z.number(),
  number: z.number(),
  label: z.string(),
  title: z.string(),
  icon: z.string(),
})

export const achievementsContentSchema = z.object({
  badge: z.string(),
  title: z.string(),
  description: z.string(),
  items: z.array(achievementItemSchema),
})

export const aboutFeatureSchema = z.object({
  id: z.number(),
  text: z.string(),
})

export const aboutStatSchema = z.object({
  id: z.number(),
  value: z.string(),
  label: z.string(),
  icon: z.string(),
})

export const aboutContentSchema = z.object({
  badge: z.string(),
  title: z.string(),
  highlight: z.string(),
  description: z.string(),
  ctaLabel: z.string(),
  image: imageSchema,
  visionTitle: z.string(),
  visionDescription: z.string(),
  missionTitle: z.string(),
  missionDescription: z.string(),
  features: z.array(aboutFeatureSchema),
  stats: z.array(aboutStatSchema),
})

export const newsItemSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  date: z.string(),
  image: imageSchema,
})

export const newsContentSchema = z.object({
  badge: z.string(),
  title: z.string(),
  highlight: z.string(),
  items: z.array(newsItemSchema),
})

export const galleryItemSchema = z.object({
  id: z.number(),
  src: imageSchema,
  title: z.string(),
})

export const galleryContentSchema = z.object({
  badge: z.string(),
  title: z.string(),
  highlight: z.string(),
  items: z.array(galleryItemSchema),
})

export const partnerItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  abbr: z.string(),
  logo: imageSchema,
})

export const partnersContentSchema = z.object({
  badge: z.string(),
  title: z.string(),
  description: z.string(),
  items: z.array(partnerItemSchema),
})

export const footerLinkSchema = z.object({
  id: z.number(),
  label: z.string(),
  href: z.string(),
})

export const footerSocialSchema = z.object({
  id: z.number(),
  label: z.string(),
  href: z.string(),
  icon: z.string(),
})

export const footerContentSchema = z.object({
  organizationName: z.string(),
  city: z.string(),
  about: z.string(),
  donateLabel: z.string(),
  quickLinks: z.array(footerLinkSchema),
  address: z.string(),
  phone: z.string(),
  email: z.string(),
  socialLinks: z.array(footerSocialSchema),
  privacyLabel: z.string(),
  termsLabel: z.string(),
  copyright: z.string(),
  fixedDonateLabel: z.string(),
})

export const colorsContentSchema = z.object({
  mode: z.enum(["single", "duo"]),
  primary: z.string(),
  secondary: z.string(),
  accent: z.string(),
  background: z.string(),
  foreground: z.string(),
  muted: z.string(),
})

export const logoContentSchema = z.object({
  logo: imageSchema,
  alt: z.string(),
})

export const adminAccountSchema = z.object({
  userId: z.string().uuid(),
  title: z.string(),
  permissions: z.array(z.union([z.enum(dashboardPermissionKeys), z.literal("*")])),
})

export const permissionsContentSchema = z.object({
  accounts: z.array(adminAccountSchema),
})

export const governanceItemSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  date: z.string(),
  fileUrl: z.string(),
})

export const governanceContentSchema = z.object({
  items: z.array(governanceItemSchema),
})

export type HeroContent = z.infer<typeof heroContentSchema>
export type DonationMethod = z.infer<typeof donationMethodSchema>
export type DonationLabel = z.infer<typeof donationLabelSchema>
export type DonationItem = z.infer<typeof donationItemSchema>
export type DonationsContent = z.infer<typeof donationsContentSchema>
export type ProjectsContent = z.infer<typeof projectsContentSchema>
export type GiftingTextPlacement = z.infer<typeof giftingTextPlacementSchema>
export type GiftingItem = z.infer<typeof giftingItemSchema>
export type GiftingsContent = z.infer<typeof giftingsContentSchema>
export type AchievementsContent = z.infer<typeof achievementsContentSchema>
export type AboutContent = z.infer<typeof aboutContentSchema>
export type NewsContent = z.infer<typeof newsContentSchema>
export type GalleryContent = z.infer<typeof galleryContentSchema>
export type PartnersContent = z.infer<typeof partnersContentSchema>
export type FooterContent = z.infer<typeof footerContentSchema>
export type ColorsContent = z.infer<typeof colorsContentSchema>
export type LogoContent = z.infer<typeof logoContentSchema>
export type PermissionsContent = z.infer<typeof permissionsContentSchema>
export type GovernanceContent = z.infer<typeof governanceContentSchema>

export const defaultHeroContent: HeroContent = {
  slides: [
    {
      id: 1,
      image: "https://images.unsplash.com/photo-1564769625905-50e93615e769?w=1920&q=80",
      title: "العناية بالمسلمين الجدد",
      subtitle: "نسعى لتقديم الرعاية والدعم للمسلمين الجدد",
      description: "ومساعدتهم على فهم الإسلام وتطبيق تعاليمه في حياتهم اليومية",
    },
    {
      id: 2,
      image: "https://images.unsplash.com/photo-1591604466107-ec97de577aff?w=1920&q=80",
      title: "التعليم والتوجيه",
      subtitle: "برامج تعليمية متكاملة",
      description: "نقدم دورات ودروسًا تعليمية تساعد المسلمين الجدد على فهم الأساسيات بثقة ووضوح.",
    },
    {
      id: 3,
      image: "https://images.unsplash.com/photo-1609599006353-e629aaabfeae?w=1920&q=80",
      title: "الدعم المجتمعي",
      subtitle: "مجتمع داعم ومتكاتف",
      description: "نوفر بيئة آمنة وداعمة تساعد المسلمين الجدد على الاندماج والاستقرار داخل المجتمع.",
    },
  ],
  donateLabel: "تبرع الآن",
  aboutLabel: "تعرف علينا",
}

export const defaultDonationsContent: DonationsContent = {
  badge: "فرص التبرع",
  title: "ساهم في دعم",
  highlight: "المسلمين الجدد",
  description: "اختر من بين فرص التبرع المتنوعة وكن سبباً في نشر الخير",
  items: [
    {
      id: 1,
      title: "كفالة مسلم جديد",
      description: "اكفل مسلماً جديداً وساهم في تعليمه أمور دينه",
      amount: 500,
      image: "https://images.unsplash.com/photo-1609599006353-e629aaabfeae?w=800&q=80",
      badge: "فرصة تبرع",
      buttonLabel: "تبرع الآن",
      donationMethod: "shares",
      minAmount: 500,
      maxAmount: null,
      defaultAmount: 500,
      totalAmount: 0,
      collectedAmount: 0,
      hideTotalAmount: false,
      hideDonation: false,
      shareUnitAmount: 500,
      labels: [
        { id: 1, label: "سهم واحد", amount: 500, sharesCount: 1 },
        { id: 2, label: "سهمان", amount: 1000, sharesCount: 2 },
        { id: 3, label: "ثلاثة أسهم", amount: 1500, sharesCount: 3 },
      ],
    },
    {
      id: 2,
      title: "الصدقة اليومية",
      description: "صدقة جارية يومية لدعم المسلمين الجدد",
      amount: 10,
      image: "https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=800&q=80",
      badge: "فرصة تبرع",
      buttonLabel: "تبرع الآن",
      donationMethod: "open_restricted",
      minAmount: 10,
      maxAmount: 500,
      defaultAmount: 50,
      totalAmount: 0,
      collectedAmount: 0,
      hideTotalAmount: true,
      hideDonation: false,
      shareUnitAmount: 0,
      labels: [
        { id: 1, label: "صدقة يومية", amount: 10, sharesCount: 1 },
        { id: 2, label: "إهداء أجر", amount: 50, sharesCount: 1 },
        { id: 3, label: "دعم إضافي", amount: 100, sharesCount: 1 },
      ],
    },
    {
      id: 3,
      title: "مشروع تبصّر",
      description: "طباعة وتوزيع الكتب والمواد التعليمية",
      amount: 200,
      image: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&q=80",
      badge: "فرصة تبرع",
      buttonLabel: "تبرع الآن",
      donationMethod: "open_unrestricted",
      minAmount: 0,
      maxAmount: null,
      defaultAmount: 200,
      totalAmount: 0,
      collectedAmount: 0,
      hideTotalAmount: true,
      hideDonation: false,
      shareUnitAmount: 0,
      labels: [
        { id: 1, label: "دعم الطباعة", amount: 200, sharesCount: 1 },
        { id: 2, label: "دعم التوزيع", amount: 350, sharesCount: 1 },
      ],
    },
  ],
}

export const defaultAchievementsContent: AchievementsContent = {
  badge: "بفضل الله",
  title: "إنجازاتنا",
  description: "نفخر بما حققناه من إنجازات بفضل الله ثم بدعمكم وثقتكم",
  items: [
    { id: 1, number: 5420, label: "ساعة", title: "ساعات التطوع", icon: "Clock" },
    { id: 2, number: 342, label: "فعالية", title: "الفعاليات الدعوية", icon: "Calendar" },
    { id: 3, number: 1250, label: "زائر", title: "الزوّار غير المسلمين", icon: "Eye" },
    { id: 4, number: 890, label: "درس", title: "الدروس", icon: "BookOpen" },
    { id: 5, number: 512, label: "متطوع", title: "المتطوعون", icon: "Users" },
  ],
}

export const defaultGiftingsContent: GiftingsContent = {
  badge: "الإهداءات",
  title: "قدّم",
  highlight: "إهداءً مباركًا",
  description: "اختر بطاقة الإهداء المناسبة، واكتب من وإلى، وسنجهّز بطاقة باسم الشخص المُهدى له.",
  dialogDescription: "أكمل بيانات الإهداء وحدد قيمة المساهمة ثم راجع شكل البطاقة قبل المتابعة.",
  senderNameLabel: "اسم المُهدي",
  senderNamePlaceholder: "مثال: أحمد محمد",
  recipientNameLabel: "اسم المُهدى له",
  recipientNamePlaceholder: "مثال: والدي الكريم",
  recipientPhoneLabel: "رقم جوال المُهدى له",
  recipientPhonePlaceholder: "05xxxxxxxx",
  previewTitle: "معاينة بطاقة الإهداء",
  submitButtonLabel: "متابعة الإهداء",
  smsHelperText: "سيتم استخدام رقم الجوال لاحقًا لإرسال إشعار الإهداء النصي بعد ربط مزود الرسائل.",
  items: [
    {
      id: 1,
      title: "إهداء صدقة جارية",
      description: "بطاقة إهداء أنيقة لصدقة جارية باسم من تحب.",
      amount: 100,
      image: "https://images.unsplash.com/photo-1519817914152-22f90e6fd1e5?w=1200&q=80",
      badge: "إهداء",
      buttonLabel: "أهدي الآن",
      donationMethod: "open_unrestricted",
      minAmount: 0,
      maxAmount: null,
      defaultAmount: 100,
      totalAmount: 0,
      collectedAmount: 0,
      hideTotalAmount: true,
      hideDonation: false,
      shareUnitAmount: 0,
      labels: [
        { id: 1, label: "إهداء عام", amount: 100, sharesCount: 1 },
        { id: 2, label: "إهداء مميز", amount: 300, sharesCount: 1 },
      ],
      senderPlacement: { x: 26, y: 74, color: "#ffffff", fontSize: 22 },
      recipientPlacement: { x: 73, y: 74, color: "#ffffff", fontSize: 22 },
      senderPrefix: "من",
      recipientPrefix: "إلى",
      smsTemplate: "لقد وصلك إهداء مبارك من {from_name} باسم {gift_title}. نسأل الله أن يتقبله ويبارك لك.",
      confirmationMessage: "تم حفظ بيانات الإهداء بنجاح، وسيظهر اسم المُهدي والمُهدى له على البطاقة.",
    },
    {
      id: 2,
      title: "إهداء مشروع خيري",
      description: "إهداء مشاركة في مشروع خيري بصورة مخصصة وبيانات واضحة.",
      amount: 250,
      image: "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=1200&q=80",
      badge: "إهداء",
      buttonLabel: "أرسل الإهداء",
      donationMethod: "shares",
      minAmount: 250,
      maxAmount: null,
      defaultAmount: 250,
      totalAmount: 0,
      collectedAmount: 0,
      hideTotalAmount: true,
      hideDonation: false,
      shareUnitAmount: 250,
      labels: [
        { id: 1, label: "سهم إهداء", amount: 250, sharesCount: 1 },
        { id: 2, label: "سهمان", amount: 500, sharesCount: 2 },
      ],
      senderPlacement: { x: 24, y: 70, color: "#f8fafc", fontSize: 24 },
      recipientPlacement: { x: 76, y: 70, color: "#fef3c7", fontSize: 24 },
      senderPrefix: "إهداء من",
      recipientPrefix: "إلى",
      smsTemplate: "أرسل لك {from_name} إهداءً خيريًا بعنوان {gift_title}. تقبل الله منه ونفعك به.",
      confirmationMessage: "تم تجهيز بطاقة الإهداء لهذا المشروع، ويمكنك مراجعة نصوصها وصورتها من لوحة التحكم.",
    },
  ],
}

export const defaultProjectsContent: ProjectsContent = {
  badge: "المشاريع",
  title: "ادعم",
  highlight: "مشاريع الجمعية",
  description: "اختر أحد المشاريع الحالية وشارك في دعمه بنفس المرونة المتاحة في فرص التبرع.",
  items: [
    {
      id: 1,
      title: "مشروع هداية",
      description: "دعم البرامج التعليمية والرعوية للمسلمين الجدد ضمن مشروع متكامل.",
      amount: 250,
      image: "https://images.unsplash.com/photo-1609599006353-e629aaabfeae?w=800&q=80",
      badge: "مشروع",
      buttonLabel: "ادعم المشروع",
      donationMethod: "shares",
      minAmount: 250,
      maxAmount: null,
      defaultAmount: 250,
      totalAmount: 0,
      collectedAmount: 0,
      hideTotalAmount: false,
      hideDonation: false,
      shareUnitAmount: 250,
      labels: [
        { id: 1, label: "سهم مشروع", amount: 250, sharesCount: 1 },
        { id: 2, label: "سهمان", amount: 500, sharesCount: 2 },
      ],
    },
    {
      id: 2,
      title: "مشروع الرعاية الشهرية",
      description: "تمويل مفتوح مقيد لتغطية الرعاية الشهرية والبرامج التشغيلية.",
      amount: 100,
      image: "https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=800&q=80",
      badge: "مشروع",
      buttonLabel: "ادعم المشروع",
      donationMethod: "open_restricted",
      minAmount: 100,
      maxAmount: 5000,
      defaultAmount: 300,
      totalAmount: 0,
      collectedAmount: 0,
      hideTotalAmount: true,
      hideDonation: false,
      shareUnitAmount: 0,
      labels: [
        { id: 1, label: "داعم", amount: 300, sharesCount: 1 },
        { id: 2, label: "داعم رئيسي", amount: 1000, sharesCount: 1 },
      ],
    },
  ],
}

export const defaultAboutContent: AboutContent = {
  badge: "من نحن",
  title: "العناية",
  highlight: "بالمسلمين الجدد",
  description:
    "جمعية خيرية متخصصة في تقديم الرعاية الشاملة للمسلمين الجدد، تأسست بهدف مساعدتهم على فهم الإسلام وتطبيق تعاليمه في حياتهم اليومية. نسعى لأن نكون الجسر الذي يربط المسلمين الجدد بدينهم ومجتمعهم.",
  ctaLabel: "تعرف علينا أكثر",
  image: "https://images.unsplash.com/photo-1609599006353-e629aaabfeae?w=800&q=80",
  visionTitle: "رؤيتنا",
  visionDescription: "الريادة في العناية بالمسلمين الجدد",
  missionTitle: "رسالتنا",
  missionDescription: "تقديم خدمات متكاملة ومتميزة",
  features: [
    { id: 1, text: "تعليم المسلمين الجدد أساسيات الإسلام" },
    { id: 2, text: "تقديم الدعم النفسي والاجتماعي" },
    { id: 3, text: "توفير المواد التعليمية بلغات متعددة" },
    { id: 4, text: "ربط المسلمين الجدد بالمجتمع المسلم" },
  ],
  stats: [
    { id: 1, icon: "Users", value: "+5000", label: "مسلم جديد" },
    { id: 2, icon: "Heart", value: "+500", label: "متطوع" },
    { id: 3, icon: "Target", value: "+100", label: "برنامج" },
    { id: 4, icon: "Eye", value: "+15", label: "سنة خبرة" },
  ],
}

export const defaultNewsContent: NewsContent = {
  badge: "آخر الأخبار",
  title: "أخبار",
  highlight: "الجمعية",
  items: [
    {
      id: 1,
      title: "حدث دعوي مميز في القصيم",
      description: "أقامت الجمعية حدثاً دعوياً مميزاً بحضور أكثر من 500 شخص من مختلف الجنسيات للتعرف على الإسلام",
      date: "05 أكتوبر 2025",
      image: "https://images.unsplash.com/photo-1609599006353-e629aaabfeae?w=800&q=80",
    },
    {
      id: 2,
      title: "ملخص إنجازات الشهر",
      description: "تقرير شامل عن إنجازات الجمعية خلال الشهر الماضي والبرامج المنفذة بنجاح",
      date: "31 ديسمبر 2025",
      image: "https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=800&q=80",
    },
    {
      id: 3,
      title: "تقرير تبصّر في شهر",
      description: "نتائج مشروع تبصّر للدعوة الإلكترونية والوصول لأكثر من 10,000 شخص حول العالم",
      date: "28 ديسمبر 2025",
      image: "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=800&q=80",
    },
  ],
}

export const defaultGalleryContent: GalleryContent = {
  badge: "معرض الصور",
  title: "ألبوم",
  highlight: "الصور",
  items: [
    { id: 1, src: "https://images.unsplash.com/photo-1609599006353-e629aaabfeae?w=800&q=80", title: "حفل تكريم المسلمين الجدد" },
    { id: 2, src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80", title: "دورة التأسيس العلمي" },
    { id: 3, src: "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=800&q=80", title: "زيارة ميدانية" },
    { id: 4, src: "https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=800&q=80", title: "توزيع سلال رمضان" },
  ],
}

export const defaultPartnersContent: PartnersContent = {
  badge: "شركاؤنا في النجاح",
  title: "شركاؤنا",
  description: "شريط هادئ وأنيق لعرض شعارات الشركاء بحركة تلقائية ناعمة من اليمين إلى اليسار.",
  items: [
    { id: 1, name: "وزارة الموارد البشرية", abbr: "وز", logo: "" },
    { id: 2, name: "هيئة الأوقاف", abbr: "هـ", logo: "" },
    { id: 3, name: "جامعة القصيم", abbr: "ق", logo: "" },
    { id: 4, name: "بنك الراجحي", abbr: "ر", logo: "" },
  ],
}

export const defaultFooterContent: FooterContent = {
  organizationName: "العناية بالمسلمين الجدد",
  city: "بريدة - القصيم",
  about:
    "جمعية خيرية تسعى لتقديم الرعاية والدعم للمسلمين الجدد ومساعدتهم على فهم الإسلام وتطبيق تعاليمه في حياتهم اليومية.",
  donateLabel: "تبرع الآن",
  quickLinks: [
    { id: 1, href: "#", label: "الرئيسية" },
    { id: 2, href: "#about", label: "من نحن" },
    { id: 3, href: "#donation", label: "فرص التبرع" },
    { id: 4, href: "#news", label: "الأخبار" },
  ],
  address: "بريدة - حي خضيراء الجنوبي",
  phone: "+966 12 345 6789",
  email: "info@newmuslims.sa",
  socialLinks: [
    { id: 1, icon: "X", label: "تويتر", href: "#" },
    { id: 2, icon: "f", label: "فيسبوك", href: "#" },
    { id: 3, icon: "in", label: "لينكدإن", href: "#" },
  ],
  privacyLabel: "سياسة الخصوصية",
  termsLabel: "الشروط والأحكام",
  copyright: "جميع الحقوق محفوظة © العناية بالمسلمين الجدد 2026",
  fixedDonateLabel: "تبرع الآن",
}

export const defaultColorsContent: ColorsContent = {
  mode: "duo",
  primary: "#019a97",
  secondary: "#01b5b2",
  accent: "#d4af37",
  background: "#fafbfc",
  foreground: "#1a1a2e",
  muted: "#f8f9fa",
}

export const defaultLogoContent: LogoContent = {
  logo: "",
  alt: "شعار الجمعية",
}

export const defaultPermissionsContent: PermissionsContent = {
  accounts: [],
}

export const defaultGovernanceContent: GovernanceContent = {
  items: [],
}

const sectionSchemas = {
  logo: logoContentSchema,
  hero: heroContentSchema,
  donations: donationsContentSchema,
  projects: projectsContentSchema,
  giftings: giftingsContentSchema,
  achievements: achievementsContentSchema,
  about: aboutContentSchema,
  news: newsContentSchema,
  gallery: galleryContentSchema,
  partners: partnersContentSchema,
  footer: footerContentSchema,
  colors: colorsContentSchema,
  permissions: permissionsContentSchema,
  governance_board: governanceContentSchema,
  governance_board_members: governanceContentSchema,
  governance_general_assembly: governanceContentSchema,
  governance_general_assembly_members: governanceContentSchema,
  governance_general_assembly_minutes: governanceContentSchema,
  governance_general_assembly_membership: governanceContentSchema,
  governance_licenses: governanceContentSchema,
  governance_registration_certificate: governanceContentSchema,
  governance_donation_site_certificate: governanceContentSchema,
  governance_policies: governanceContentSchema,
  governance_committees: governanceContentSchema,
  governance_endowments: governanceContentSchema,
}

const defaultContent = {
  logo: defaultLogoContent,
  hero: defaultHeroContent,
  donations: defaultDonationsContent,
  projects: defaultProjectsContent,
  giftings: defaultGiftingsContent,
  achievements: defaultAchievementsContent,
  about: defaultAboutContent,
  news: defaultNewsContent,
  gallery: defaultGalleryContent,
  partners: defaultPartnersContent,
  footer: defaultFooterContent,
  colors: defaultColorsContent,
  permissions: defaultPermissionsContent,
  governance_board: defaultGovernanceContent,
  governance_board_members: defaultGovernanceContent,
  governance_general_assembly: defaultGovernanceContent,
  governance_general_assembly_members: defaultGovernanceContent,
  governance_general_assembly_minutes: defaultGovernanceContent,
  governance_general_assembly_membership: defaultGovernanceContent,
  governance_licenses: defaultGovernanceContent,
  governance_registration_certificate: defaultGovernanceContent,
  governance_donation_site_certificate: defaultGovernanceContent,
  governance_policies: defaultGovernanceContent,
  governance_committees: defaultGovernanceContent,
  governance_endowments: defaultGovernanceContent,
}

type SectionKey = keyof typeof sectionSchemas

export type SiteSectionKey = SectionKey

export const siteSectionKeys = Object.keys(sectionSchemas) as SiteSectionKey[]

export const governanceSiteSectionKeys = governanceSectionKeys as SiteSectionKey[]

export async function getSiteSectionContent<T extends SectionKey>(section: T): Promise<(typeof defaultContent)[T]> {
  noStore()

  const supabase = createSupabaseAdminClient()
  const { data } = await supabase.from("site_content").select("content").eq("section_key", section).maybeSingle<{ content: unknown }>()

  const parsed = sectionSchemas[section].safeParse(data?.content)
  return parsed.success ? parsed.data : defaultContent[section]
}

export async function upsertSiteSectionContent<T extends SectionKey>(section: T, content: unknown) {
  const parsed = sectionSchemas[section].parse(content)
  const supabase = createSupabaseAdminClient()

  const { error } = await supabase.from("site_content").upsert({ section_key: section, content: parsed }, { onConflict: "section_key" })

  if (error) {
    throw new Error(error.message)
  }

  return parsed
}

export async function getAdminPermissionsConfig() {
  return getSiteSectionContent("permissions")
}

export function getDefaultAdminPermissions(): Array<DashboardPermissionKey | "*"> {
  return ["*"]
}
