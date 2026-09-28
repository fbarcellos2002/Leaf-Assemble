"use client";

import { deleteUser } from "./actions";

type Props = { name: string };

export function RemoveUserButton({ name }: Props) {
  return (
    <button
      className="h-10 rounded-lg border border-[#e6cbc6] px-4 text-sm font-semibold text-[#8d493f] transition hover:bg-[#fff5f3]"
      formAction={deleteUser}
      formNoValidate
      onClick={(event) => {
        if (!window.confirm(`Remover a conta de ${name}? Esta ação não pode ser desfeita.`)) {
          event.preventDefault();
        }
      }}
      type="submit"
    >
      Remover
    </button>
  );
}
