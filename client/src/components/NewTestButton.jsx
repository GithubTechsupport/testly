import { Link } from "react-router-dom";

export default function NewTestButton() {
  return (
<Link to={"/TestCreation"}>
<button class="fixed bottom-10 right-10 bg-[#334155] hover:bg-[#475569] text-white font-bold rounded-full w-16 h-16 flex items-center justify-center drop-shadow-2xl">
  <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
</button>
</Link>
  )
}