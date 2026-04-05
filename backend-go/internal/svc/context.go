package svc

import (
	"database/sql"
	"log"
	"sync"
)

type ServiceContext struct {
	DB       *sql.DB
	DBPath   string
}

var (
	sc   *ServiceContext
	once sync.Once
)

func NewServiceContext() *ServiceContext {
	once.Do(func() {
		db, path, err := OpenSQLite()
		if err != nil {
			log.Fatalf("sqlite: %v", err)
		}
		sc = &ServiceContext{DB: db, DBPath: path}
		log.Println("service context initialized")
	})
	return sc
}

func (sc *ServiceContext) Close() {
	if sc.DB != nil {
		if err := sc.DB.Close(); err != nil {
			log.Printf("close database: %v", err)
		}
	}
	log.Println("service context closed")
}

