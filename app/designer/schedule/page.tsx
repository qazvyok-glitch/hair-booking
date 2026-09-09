import { redirect } from "next/navigation";
import { appRoutes } from "../../../lib/appRoutes";

export default function DesignerScheduleRedirect() {
  redirect(appRoutes.designer.home);
}

