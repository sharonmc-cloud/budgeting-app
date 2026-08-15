type CategoryButtonProps = {
  label: string
  onClick: () => void
}

function CategoryButton({ label, onClick }: CategoryButtonProps) {
  return <button onClick={onClick}>{label}</button>
}

export default CategoryButton