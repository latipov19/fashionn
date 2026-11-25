import { copy } from "@/content/copy";
import "../store.css";

/** The shop's own shape while the catalogue loads: the heading, the toolbar and a grid of quiet cards. */
export default function ShopLoading() {
  return (
    <div className="shop-page" aria-busy="true">
      <div className="shell">
        <p className="sr-only" role="status">
          {copy.shop.loading}
        </p>
        <div className="shop-head" aria-hidden="true">
          <span className="skeleton skeleton-line" style={{ width: "9rem" }} />
          <span className="skeleton skeleton-title" />
        </div>
        <div className="shop-layout" aria-hidden="true">
          <div className="shop-aside">
            <span className="skeleton skeleton-block" />
          </div>
          <div className="shop-main">
            <span className="skeleton skeleton-bar" />
            <ul className="shop-grid">
              {Array.from({ length: 8 }, (_, index) => (
                <li key={index}>
                  <span className="skeleton skeleton-card" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
