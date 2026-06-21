import { AppChrome } from "@/components/app-chrome";
import { TodoTool } from "@/components/todo-tool";

export default function TodoPage() {
  return (
    <AppChrome active="life">
      <TodoTool />
    </AppChrome>
  );
}
