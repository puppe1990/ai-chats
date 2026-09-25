import Select, { createFilter, type ClassNamesConfig } from 'react-select'

export interface FolderFilterOption {
  value: string
  label: string
}

export interface FolderFilterSelectProps {
  inputId: string
  value: string
  options: FolderFilterOption[]
  placeholder: string
  noOptionsMessage: string
  onChange: (folder: string) => void
}

/** Match the typed text against the shortened label and the full path. */
const filterFolderOption = createFilter<FolderFilterOption>({
  stringify: (option) => `${option.label} ${option.value}`,
})

const CLASS_NAMES: ClassNamesConfig<FolderFilterOption, false> = {
  container: () => 'relative w-full max-w-full sm:w-80',
  control: ({ isFocused }) =>
    [
      'flex items-center overflow-hidden rounded-lg border bg-white px-3 py-1.5 text-sm shadow-sm transition dark:bg-zinc-900',
      isFocused
        ? 'border-zinc-400 ring-1 ring-zinc-300 dark:border-zinc-400 dark:ring-zinc-500'
        : 'border-zinc-200 dark:border-zinc-600',
    ].join(' '),
  valueContainer: () => 'min-w-0 flex-1 overflow-hidden',
  singleValue: () => 'truncate text-zinc-900 dark:text-zinc-50',
  placeholder: () => 'truncate text-zinc-400 dark:text-zinc-400',
  input: () => 'text-zinc-900 dark:text-zinc-50',
  indicatorsContainer: () => 'shrink-0 text-zinc-500 dark:text-zinc-300',
  indicatorSeparator: () => 'mx-1 self-stretch w-px bg-zinc-200 dark:bg-zinc-600',
  dropdownIndicator: () =>
    'px-0.5 transition hover:text-zinc-900 dark:hover:text-zinc-50',
  menu: () =>
    'mt-1 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-600 dark:bg-zinc-900',
  menuList: () => 'max-h-72 overflow-y-auto p-1',
  option: ({ isFocused, isSelected }) =>
    [
      'cursor-pointer truncate rounded-md px-2.5 py-1.5 text-sm',
      isSelected
        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
        : isFocused
          ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50'
          : 'text-zinc-700 dark:text-zinc-200',
    ].join(' '),
  noOptionsMessage: () => 'px-2 py-1.5 text-sm text-zinc-500 dark:text-zinc-300',
}

/**
 * Searchable folder filter for the chat list. Picking is single-shot: the
 * "all folders" entry stays an option, so no clear affordance is needed.
 */
export function FolderFilterSelect({
  inputId,
  value,
  options,
  placeholder,
  noOptionsMessage,
  onChange,
}: FolderFilterSelectProps) {
  const selectedOption = options.find((option) => option.value === value) ?? null

  return (
    <Select<FolderFilterOption>
      inputId={inputId}
      unstyled
      classNamePrefix="folder-select"
      classNames={CLASS_NAMES}
      filterOption={filterFolderOption}
      options={options}
      value={selectedOption}
      placeholder={placeholder}
      noOptionsMessage={() => noOptionsMessage}
      onChange={(next) => {
        if (next) onChange(next.value)
      }}
    />
  )
}
