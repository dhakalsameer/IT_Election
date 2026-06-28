export default function SectionHeader({ icon, title }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-sky-400/30 bg-sky-400/10 text-sky-300 text-lg">
        {icon}
      </div>
      <h3 className="text-base font-black uppercase tracking-wider text-app-heading">{title}</h3>
    </div>
  );
}
