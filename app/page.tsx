import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="bg-muted flex min-h-svh items-center justify-center p-6 md:p-10">
      <div className="z-2 bg-muted p-3 border-0 rounded-xl">
        <h1 className="text-3xl">What are you waiting for?</h1>
        <Button asChild>
          <Link href="/my">{"Let's play!"}</Link>
        </Button>
      </div>
      <div className="w-full max-w-sm md:max-w-4xl z-1">
        <Image
          src="/images/landing-grayish.png"
          alt="Landing page image"
          fill
          className="object-contain object-right min-h-dvh"
          priority
        />
      </div>
    </div>
  );
}
