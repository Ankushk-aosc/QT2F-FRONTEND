"use server"

import { getEnv } from "@/lib/env";
import { redirect } from "next/navigation";

export async function handleQlikRedirect() {
    const env = getEnv();
    if (env.QLIK_URL) {
        redirect(env.QLIK_URL);
    } else {
        throw new Error("Qlik URL not configured");
    }
}
