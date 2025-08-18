"use client";
import { useEffect, useState } from "react";

import { PropsWithChildren } from "react";

export default function HydrationWrapper({ children }: PropsWithChildren<{}>) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return <>{children}</>;
}

export { HydrationWrapper };
