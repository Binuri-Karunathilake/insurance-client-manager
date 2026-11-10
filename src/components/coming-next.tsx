import { Icon, type IconName } from "./icons";

export function ComingNext({ title, body, note, icon }: { title: string; body: string; note: string; icon: IconName }) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <h1 className="text-title">{title}</h1>
      <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-surface p-6">
        <span className="flex size-10 items-center justify-center rounded-md bg-primary-soft text-primary">
          <Icon name={icon} size={20} />
        </span>
        <p className="text-body">{body}</p>
        <p className="text-caption text-muted">{note}</p>
      </div>
    </div>
  );
}
