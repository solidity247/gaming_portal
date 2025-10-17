import { ReactElement } from "react";
import BoardChecker from "./BoardChecker";

export default function BoardCell({
  children,
  id,
  className,
}: {
  children?:
    | ReactElement<typeof BoardChecker>
    | ReactElement<typeof BoardChecker>[];
  id: string;
  className?: string;
}) {
  return (
    <li
      id={id}
      className={`flex flex-col items-center ${className} border border-gray-400 gap-0.5`}
    >
      {children}
    </li>
  );
}
