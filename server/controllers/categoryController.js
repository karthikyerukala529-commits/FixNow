import Category from '../models/Category.js'

export async function listCategories(req, res, next) {
  try {
    const categories = await Category.find({ isActive: true }).sort({ order: 1 })
    res.json({ success: true, categories })
  } catch (err) { next(err) }
}
