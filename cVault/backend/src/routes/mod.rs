pub mod vault;

use crate::state::AppState;
use axum::Router;

pub fn router() -> Router<AppState> {
    Router::new().merge(vault::router())
}
