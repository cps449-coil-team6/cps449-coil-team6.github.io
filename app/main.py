# -*- coding: utf-8 -*-
"""Reorganized DATA.ipynb script as a Python module with FastAPI server"""

# === Imports ===
import numpy as np
import pandas as pd
import ast
import pickle
from fastapi import FastAPI
from nltk.stem.porter import PorterStemmer
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.model_selection import cross_val_score, KFold
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from fastapi.middleware.cors import CORSMiddleware

# === Load and Merge Datasets ===
movies = pd.read_csv("tmdb_5000_movies.csv")
credits = pd.read_csv("tmdb_5000_credits.csv")
movies = movies.merge(credits, on='title')

# === Select and Clean Columns ===
movies = movies[['id', 'title', 'overview', 'genres', 'keywords', 'cast', 'crew', 'vote_average', 'budget', 'runtime', 'popularity', 'vote_count']]
movies.dropna(inplace=True)

# === Conversion Functions ===
def convert(text):
    return [i['name'] for i in ast.literal_eval(text)]

def convert3(text):
    return [i['name'] for i in ast.literal_eval(text)[:3]]

def fetch_director(text):
    return [i['name'] for i in ast.literal_eval(text) if i['job'] == 'Director']

def collapse(L):
    return [i.replace(" ", "") for i in L]

# === Apply Conversions ===
movies['genres'] = movies['genres'].apply(convert)
movies['keywords'] = movies['keywords'].apply(convert)
movies['cast'] = movies['cast'].apply(convert)
movies['crew'] = movies['crew'].apply(fetch_director)

movies['cast'] = movies['cast'].apply(collapse)
movies['crew'] = movies['crew'].apply(collapse)
movies['genres'] = movies['genres'].apply(collapse)
movies['keywords'] = movies['keywords'].apply(collapse)
movies['overview'] = movies['overview'].apply(lambda x: x.split())

# === Create Tags Column ===
movies['tags'] = movies['overview'] + movies['genres'] + movies['keywords'] + movies['cast'] + movies['crew']
new = movies.drop(columns=['overview','genres','keywords','cast','crew'])
new['tags'] = new['tags'].apply(lambda x: " ".join(x).lower())

# === Stemming ===
ps = PorterStemmer()
def stem(text):
    return " ".join([ps.stem(i) for i in text.split()])
new['tags'] = new['tags'].apply(stem)

# === Vectorization ===
cv = CountVectorizer(max_features=5000, stop_words='english')
vector = cv.fit_transform(new['tags']).toarray()
similarity = cosine_similarity(vector)

# === Recommendation Function ===
def recommendM(movie):
    movie = movie.lower()
    index = new[new['title'].str.lower() == movie].index
    if len(index) == 0:
        return {"error": "Movie is not in the database or wrong name"}
    index = index[0]
    distances = sorted(list(enumerate(similarity[index])), reverse=True, key=lambda x: x[1])
    return [{"id": int(new.iloc[i[0]].id), "title": new.iloc[i[0]].title} for i in distances[1:6]]

# === Save Pickles ===
pickle.dump(new, open('movie_list.pkl', 'wb'))
pickle.dump(similarity, open('similarity.pkl', 'wb'))

# === Labeling for Supervised Learning ===
def label_recommendation(row):
    if row['vote_average'] >= 8.0 or (row['vote_count'] >= 6000 and row['vote_average'] >= 7):
        return 'high'
    elif row['vote_average'] >= 6.0 and row['vote_count'] >= 4000:
        return 'average'
    else:
        return 'none'

def label_vote_average(score):
    return 'high' if score >= 7 else 'average' if score >= 6 else 'low'

def label_vote_count(count):
    return 'high' if count >= 8000 else 'average' if count >= 4000 else 'low'

def label_popularity(score):
    return 'high' if score >= 120 else 'average' if score >= 80 else 'low'

def label_budget(amount):
    return 'high' if amount >= 250000000 else 'average' if amount >= 150000000 else 'low'

def label_runtime(time):
    return 'long' if time >= 150 else 'medium' if time >= 100 else 'short'

popularity = new.drop(columns=['tags'])
popularity['vote_average_label'] = popularity['vote_average'].apply(label_vote_average)
popularity['vote_count_label'] = popularity['vote_count'].apply(label_vote_count)
popularity['popularity_label'] = popularity['popularity'].apply(label_popularity)
popularity['budget_label'] = popularity['budget'].apply(label_budget)
popularity['runtime_label'] = popularity['runtime'].apply(label_runtime)
popularity['recommendation'] = popularity.apply(label_recommendation, axis=1)

popularity_label = popularity.drop(columns=['vote_average', 'vote_count', 'popularity', 'budget', 'runtime'])
popularity_label = popularity_label.drop(columns=['id', 'title'])

# === Encode and Train Model ===
df = popularity_label.copy()
for col in df.columns[:-1]:
    df[col] = LabelEncoder().fit_transform(df[col])

X = df.drop('recommendation', axis=1)
y = LabelEncoder().fit_transform(df['recommendation'])
model = RandomForestClassifier(random_state=42)
scores = cross_val_score(model, X, y, cv=KFold(n_splits=20, shuffle=True, random_state=42), scoring='accuracy')
print("Cross-validation scores:", scores)
print("Mean cross-validation score:", np.mean(scores))
model.fit(X, y)

# === FastAPI Setup ===
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
new = pickle.load(open("movie_list.pkl", "rb"))
similarity = pickle.load(open("similarity.pkl", "rb"))

@app.get("/")
def read_root():
    return {"message": "Hello"}

@app.get("/movielist")
def movie_list():
    return {"movies": new[['id', 'title']].to_dict('records')}

@app.get("/recommend/{movie}")
def recommend(movie: str):
    return {"recommendations": recommendM(movie)}

@app.get("/popular")
def popular():
    populars = new.groupby(['id', 'title'])['vote_average'].mean().sort_values(ascending=False).head(50).reset_index()
    return {"populars": populars[['id', 'title','vote_average']].to_dict('records')}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
