import { redirect } from "next/navigation";
import { WORKSPACES } from "@/lib/demo-data";

export default function Home() {
  redirect(`/w/${WORKSPACES[0].id}`);
}
