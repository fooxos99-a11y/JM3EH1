import { getSiteSectionContent } from "@/lib/site-content"

export async function PartnersSection() {
  const content = await getSiteSectionContent("partners")
  const marqueePartners = [...content.items, ...content.items]

  return (
    <section className="relative overflow-hidden bg-white py-16">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,0))]" />

      <div className="container relative mx-auto mb-8 px-4">
        <div className="text-center">
          <span className="mb-4 inline-block rounded-full border border-border bg-white px-4 py-1.5 text-sm font-medium text-primary">
            {content.badge}
          </span>
          <h2 className="text-3xl font-bold text-foreground md:text-4xl">
            {content.title}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
            {content.description}
          </p>
        </div>
      </div>

      <div className="relative">
        <div className="partners-fade absolute inset-y-0 left-0 z-10 w-20 md:w-32" />
        <div className="partners-fade absolute inset-y-0 right-0 z-10 w-20 scale-x-[-1] md:w-32" />

        <div className="overflow-hidden" dir="ltr">
          <div className="partners-marquee flex w-max gap-5 px-4 md:gap-6">
            {marqueePartners.map((partner, index) => (
              <div
                key={`${partner.id}-${index}`}
                className="group flex h-[152px] w-[168px] flex-shrink-0 flex-col items-center justify-center rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)] sm:w-[184px] md:w-[196px] lg:w-[208px] xl:w-[220px]"
              >
                {partner.logo ? (
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-50 transition-all duration-500 group-hover:scale-105 group-hover:border-primary/20">
                    <img src={partner.logo} alt={partner.name} className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] border border-slate-200 bg-slate-50 text-lg font-bold text-primary transition-all duration-500 group-hover:scale-105 group-hover:border-primary/20">
                    <span>{partner.abbr}</span>
                  </div>
                )}

                <div className="mt-3 text-center" dir="rtl">
                  <span className="line-clamp-2 block text-sm font-semibold leading-6 text-foreground">
                    {partner.name}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    مساحة الشعار
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
