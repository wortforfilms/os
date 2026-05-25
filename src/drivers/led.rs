pub struct Led;

impl Led {
    pub fn new() -> Self { Self }
    pub fn toggle(&mut self) { /* drive GPIO here */ }
}
