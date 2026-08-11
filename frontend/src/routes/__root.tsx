import { Link, Outlet, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div className="app-shell">
      <nav className="app-nav">
        <Link to="/" activeOptions={{ exact: true }}>
          Dashboard
        </Link>
        <Link to="/workouts">Workouts</Link>
        <Link to="/exercises">Exercises</Link>
      </nav>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
