type CategoryButtonProps = {
  label: string
  onClick: () => void
  selected: boolean
  disabled?: boolean
}

function CategoryButton({ label, onClick, selected, disabled = false }: CategoryButtonProps) {
  return (
    <button
      className="category-button"
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

export default CategoryButton
