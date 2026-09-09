import { redirect } from "next/navigation";
import { appRoutes } from "../../../lib/appRoutes";

export default function DesignerTransactionRedirect() {
  redirect(appRoutes.designer.home);
}

