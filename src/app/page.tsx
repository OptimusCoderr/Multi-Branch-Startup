import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Multi-Branch Inventory</h1>
      <p className="max-w-md text-gray-500">
        Manage products, warehouses, branches, staff, and sales across every location — with a
        full accountability trail for every stock movement.
      </p>
      <div className="flex gap-3">
        <Link
          href="/sign-up"
          className="rounded-md bg-black px-5 py-2.5 text-sm font-medium text-white"
        >
          Start free trial
        </Link>
        <Link
          href="/sign-in"
          className="rounded-md border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
