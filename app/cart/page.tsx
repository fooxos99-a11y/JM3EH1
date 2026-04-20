import { CartPageClient } from "@/components/cart-page-client"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"

export default function CartPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7fbfb,#eef6f6)]">
      <Header />
      <section className="container mx-auto px-4 pb-16 pt-32">
        <CartPageClient />
      </section>
      <Footer />
    </main>
  )
}