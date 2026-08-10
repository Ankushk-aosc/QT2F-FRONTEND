// app/page.tsx
"use client";

import { useIsAuthenticated } from "@azure/msal-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
    Card,
    Text,
    Image,
} from "@fluentui/react-components";
import { handleQlikRedirect } from "@/lib/actions/config.actions";
import { useUIStore } from "@/stores/ui.store";

export default function HomePage() {
    const router = useRouter();
    const isAuthenticated = useIsAuthenticated();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleTableauSelect = () => {
        useUIStore.getState().setWorkspace("tableau");
        if (isAuthenticated) {
            router.push("/dashboard");
        } else {
            router.push("/signin");
        }
    };

    const handleQlikSelect = () => {
        useUIStore.getState().setWorkspace("qlik");
        if (isAuthenticated) {
            router.push("/dashboard");
        } else {
            router.push("/signin");
        }
    };

    if (!mounted) return null;

    return (
        <div className="selection-page-root">
            <header className="selection-header">
                <Image 
                    src="/Switchblade_Logo.png" 
                    alt="Switchblade Logo" 
                    className="selection-logo"
                />
            </header>

            <main className="selection-main">
                <div className="selection-title-group">
                    <h1 className="selection-title">
                        Choose Your <span className="selection-brand-text">Migration Path</span>
                    </h1>
                    <p className="selection-subtitle">
                        Unlock the potential of your data by migrating from legacy platforms to Microsoft Fabric.
                    </p>
                </div>

                <div className="selection-cards">
                    <Card className="selection-card" onClick={handleQlikSelect}>
                        <div className="selection-card-icon-wrapper">
                            <Image
                                src="/Qlik logo.png"
                                alt="Qlik"
                                className="selection-card-icon"
                            />
                        </div>
                        <Text className="selection-card-title">Qlik to Fabric</Text>
                    </Card>

                    <Card className="selection-card" onClick={handleTableauSelect}>
                        <div className="selection-card-icon-wrapper">
                            <Image
                                src="https://img.icons8.com/?size=100&id=9Kvi1p1F0tUo&format=png&color=000000"
                                alt="Tableau"
                                className="selection-card-icon"
                            />
                        </div>
                        <Text className="selection-card-title">Tableau to Fabric</Text>
                    </Card>
                </div>
            </main>
        </div>
    );
}