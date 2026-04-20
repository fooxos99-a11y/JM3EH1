import type { ProjectsContent } from "@/lib/site-content"

import { FundraisingEditor } from "@/components/dashboard/fundraising-editor"

export function ProjectsEditor({ initialContent }: { initialContent: ProjectsContent }) {
  return (
    <FundraisingEditor
      initialContent={initialContent}
      sectionKey="projects"
      sectionLabel="المشروع"
      itemLabel="مشروع"
      addItemLabel="إضافة مشروع"
      saveMessage="تم حفظ المشاريع"
      saveErrorMessage="تعذر حفظ المشاريع"
      saveHint="سيتم تحديث بطاقات المشاريع مباشرة بعد الحفظ."
      defaultBadge="مشروع"
      defaultButtonLabel="ادعم المشروع"
    />
  )
}
