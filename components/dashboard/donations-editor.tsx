import type { DonationsContent } from "@/lib/site-content"

import { FundraisingEditor } from "@/components/dashboard/fundraising-editor"

export function DonationsEditor({ initialContent }: { initialContent: DonationsContent }) {
  return (
    <FundraisingEditor
      initialContent={initialContent}
      sectionKey="donations"
      sectionLabel="الفرصة"
      itemLabel="فرصة"
      addItemLabel="إضافة فرصة"
      saveMessage="تم حفظ فرص التبرع"
      saveErrorMessage="تعذر حفظ فرص التبرع"
      saveHint="سيتم تحديث بطاقات فرص التبرع مباشرة بعد الحفظ."
      defaultBadge="فرصة تبرع"
      defaultButtonLabel="تبرع الآن"
    />
  )
}