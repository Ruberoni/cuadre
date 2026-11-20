import { EyeIcon, EyeOffIcon } from "lucide-react";
import { type ComponentProps, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PasswordInputLabels = {
  show: string;
  hide: string;
  showAriaLabel: string;
  hideAriaLabel: string;
  /** Read by the polite live region after each toggle. */
  shownStatus: string;
  hiddenStatus: string;
};

type PasswordInputProps = Omit<ComponentProps<"input">, "type"> & {
  /** Controlled, so the form can hide the password again on submit. */
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  labels: PasswordInputLabels;
};

/**
 * Design System → PasswordInput: one bordered box holding a borderless input and a trailing
 * show/hide button. The box draws the focus ring only while the input has focus; the button draws
 * its own. Starts hidden; the live region speaks only after the user toggles.
 */
export function PasswordInput({
  visible,
  onVisibleChange,
  labels,
  className,
  id,
  ...props
}: PasswordInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  // The visibility the user last chose with the button. Hiding it from outside (submit) clears it.
  const [chosen, setChosen] = useState<boolean | undefined>(undefined);
  const status = chosen === visible ? (visible ? labels.shownStatus : labels.hiddenStatus) : "";

  return (
    <>
      <div
        data-invalid={props["aria-invalid"] === true || props["aria-invalid"] === "true"}
        className={cn(
          "flex h-(--control-height) items-center gap-1 rounded-md border border-input bg-background pr-1",
          "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ring",
          "data-[invalid=true]:border-destructive",
          className,
        )}
      >
        <input
          {...props}
          id={inputId}
          type={visible ? "text" : "password"}
          spellCheck={false}
          autoCapitalize="off"
          className="h-full min-w-0 flex-1 rounded-md bg-transparent px-3 text-body focus-visible:outline-none"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-controls={inputId}
          aria-label={visible ? labels.hideAriaLabel : labels.showAriaLabel}
          onClick={() => {
            setChosen(!visible);
            onVisibleChange(!visible);
          }}
        >
          {visible ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
          {visible ? labels.hide : labels.show}
        </Button>
      </div>
      <span className="sr-only" aria-live="polite">
        {status}
      </span>
    </>
  );
}
