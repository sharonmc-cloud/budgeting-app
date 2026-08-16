type CategoryButtonProps = {
  label: string
  onClick: () => void
  selected: boolean
}

function CategoryButton({ label, onClick, selected }: CategoryButtonProps) {
  return (
    <button
      className="category-button"
      type="button"
      aria-pressed={selected}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

export default CategoryButton
